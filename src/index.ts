#!/usr/bin/env node

'use strict'
import { Argument, program } from 'commander'
import { NAME, DESCRIPTION, VERSION } from './metadata'
import { ILogObj, Logger } from 'tslog'
import { LoggerFactory } from './logging/LoggerFactory'
import { PreloadConverter } from './converter/PreloadConverter'
import { lstatSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import directoryTree from 'directory-tree'
import chokidar from 'chokidar';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
require('source-map-support').install()

let log: Logger<ILogObj>

let watchForChanges = false;
let skip = false;

async function protectedAction(input: string, output: string, action: (input: string, output: string) => Promise<void>) {
  try {
    await action(input, output);
  } catch (exception) {
    log.fatal(exception);
  }
}

async function conversionAction(input: string, output: string, outputFileExtension: string | undefined, action: (input: string, output: string) => Promise<void>) {
  let folderMode = false;

  const inputFileStat = lstatSync(input, { throwIfNoEntry: false });
  if (inputFileStat == null) {
    throw new Error("Input file or directory doesn't exist!");
  }

  const outputFileStat = lstatSync(output, { throwIfNoEntry: false });
  if (inputFileStat.isDirectory()) {
    if (outputFileStat != null && !outputFileStat.isDirectory()) {
      throw new Error("Input is a directory, output path exists and was identified as not a directory.");
    }
    if (!outputFileExtension) {
      throw new Error("Input and output are directories, you must define a outputFileExtension!");
    }
    folderMode = true;
  }

  const resolvedOutputs = new Set();
  if (watchForChanges) {
    const watcher = chokidar.watch(input, { persistent: true });
    watcher.on('change', async (inputPath) => {
      log.info("File change detected for: ", inputPath);

      let outputPath;
      if (folderMode) {
        outputPath = path.join(output, path.relative(input, inputPath)).replace(path.extname(inputPath), outputFileExtension as string);
        const outputFolder = path.dirname(outputPath);
        if (!resolvedOutputs.has(outputFolder)) {
          resolvedOutputs.add(outputFolder);
          await mkdir(outputFolder, { recursive: true });
        }
      } else {
        outputPath = output;
      }
      await protectedAction(inputPath, outputPath, action);
    });
  }

  if (!skip) {
    if (folderMode) {
      directoryTree(input, undefined, async (item, filePath, stats) => {
        const outputPath = path.join(output, path.relative(input, filePath)).replace(path.extname(filePath), outputFileExtension as string);
        const outputFolder = path.dirname(outputPath);
        if (!resolvedOutputs.has(outputFolder)) {
          resolvedOutputs.add(outputFolder);
          await mkdir(outputFolder, { recursive: true });
        }
        await protectedAction(filePath, outputPath, action);;
      })
    } else {
      await protectedAction(input, output, action);
    }
  }
}

program
  .name(NAME)
  .version(VERSION)
  .description(DESCRIPTION)
  .option('-w --watch', 'Command will trigger now and automatically on file change event.')
  .option('-s --watch-skip', 'Command will automatically trigger only on file change event.')
  .hook('preAction', (thisCommand, actionCommand) => {
    log = LoggerFactory.createLogger('main');
    const options = thisCommand.opts();

    log.debug('command:', actionCommand.name())
    log.debug('arguments:', actionCommand.args.join(', '))
    log.debug('options:', JSON.stringify(thisCommand.opts()))
    watchForChanges = options.watch || options.watchSkip;
    skip = options.watchSkip;
  });

program
  .command('pld2text')
  .description('Convert preload file (.pld or .txt) into a text readable file without the Preload calls.')
  .addArgument(new Argument('<input>', 'input file or folder').argRequired())
  .addArgument(new Argument('<output>', 'output file or folder').argRequired())
  .addArgument(new Argument('<outputFileExtension>', 'output file extension required if input and output are folders').argOptional())
  .action(async (input: string, output: string, outputFileExtension: string | undefined) => {
    await conversionAction(input, output, outputFileExtension, PreloadConverter.parsePreloadFile);
  });

program
  .command('text2pld')
  .description('Compile any given file into a preload (.pld) file by wrapping each line in a \'Preload\' call and the entire file into a standard preload procedure.')
  .addArgument(new Argument('<input>', 'input file or folder').argRequired())
  .addArgument(new Argument('<output>', 'output file or folder').argRequired())
  .addArgument(new Argument('<functionName>', 'preload file\'s main function name.').argRequired())
  .addArgument(new Argument('<outputFileExtension>', 'output file extension required if input and output are folders').argOptional())
  .action(async (input: string, output: string, functionName: string, outputFileExtension: string | undefined) => {
    await conversionAction(input, output, outputFileExtension, (inputPath, outputPath) => PreloadConverter.compilePreloadFile(inputPath, outputPath, functionName));
  });

program.parse();