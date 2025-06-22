#!/usr/bin/env node

'use strict'
import { Argument, program } from 'commander'
import { NAME, DESCRIPTION, VERSION } from './metadata'
import { ILogObj, Logger } from 'tslog'
import { LoggerFactory } from './logging/LoggerFactory'
import { PreloadConverter } from './converter/PreloadConverter'
import { lstatSync, watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import directoryTree from 'directory-tree'
import chokidar from 'chokidar';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
require('source-map-support').install()

let log: Logger<ILogObj>

let watchForChanges = false;
let skip = false;

async function conversionAction(input: string, output: string) {
  try {
    await PreloadConverter.convertPreloadFile(input, output);
  } catch (exception) {
    log.fatal(exception);
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

    if (watchForChanges) {
      const resolvedOutputs = new Set();
      const watcher = chokidar.watch(input, { persistent: true });
      watcher.on('change', async (inputPath) => {
        log.info("File change detected for: ", inputPath);

        let outputPath;
        if (folderMode) {
          outputPath = path.join(output, path.relative(input, inputPath)).replace(path.extname(inputPath), outputFileExtension as string);
          if (!resolvedOutputs.has(outputPath)){
            resolvedOutputs.add(outputPath)
            await mkdir(path.dirname(outputPath), { recursive: true })
          }
        } else {
          outputPath = output;
        }
        await conversionAction(inputPath, outputPath);
      });
    }

    if (!skip) {
      if (folderMode) {
        directoryTree(input, undefined, async (item, filePath, stats) => {
          const outputPath = path.join(output, path.relative(input, filePath)).replace(path.extname(filePath), outputFileExtension as string);
          await mkdir(path.dirname(outputPath), { recursive: true })
          await conversionAction(filePath, outputPath);
        })
      } else {
        await conversionAction(input, output);
      }
    }
  });

program.parse();