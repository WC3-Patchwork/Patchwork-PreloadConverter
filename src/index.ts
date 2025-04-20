#!/usr/bin/env node

'use strict'
import { Argument, program } from 'commander'
import { NAME, DESCRIPTION, VERSION } from './metadata'
import { ILogObj, Logger } from 'tslog'
import { LoggerFactory } from './logging/LoggerFactory'
import { PreloadConverter } from './converter/PreloadConverter'
import { watch } from 'node:fs'

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
require('source-map-support').install()

let log: Logger<ILogObj>

let watchForChanges = false;

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
  .option('-w --watch', 'Command will automatically trigger on file change event.')
  .hook('preAction', (thisCommand, actionCommand) => {
    log = LoggerFactory.createLogger('main');
    const options = thisCommand.opts();

    log.debug('command:', actionCommand.name())
    log.debug('arguments:', actionCommand.args.join(', '))
    log.debug('options:', JSON.stringify(thisCommand.opts()))
    watchForChanges = options.watch;
  });

program
  .command('pld2text')
  .description('Convert preload file (.pld or .txt) into a text readable file without the Preload calls.')
  .addArgument(new Argument('<input>', 'input file').argRequired())
  .addArgument(new Argument('<output>', 'output file').argRequired())
  .action(async (input: string, output: string) => {
    await conversionAction(input, output);
    if (watchForChanges) {
      watch(input, { persistent: true }, async (eventType, filename) => {
        if (eventType == "change"){
          log.info("File change detected.");
          await conversionAction(input, output);
        }
      });
    }
  });

program.parse();