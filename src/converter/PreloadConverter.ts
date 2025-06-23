import { createReadStream } from "fs";
import { writeFile } from "fs/promises";
import { LoggerFactory } from "../logging/LoggerFactory";
import { createInterface } from "readline";
import { EOL } from "node:os";

const log = LoggerFactory.createLogger("PreloadConverter");

const preloadRegex = /call Preload\(\s*\"(?<content>.*)\"\s*\)/gm;

async function extractPreloadLines(inputPath: string): Promise<string[]> {
    const fileStream = createReadStream(inputPath);
    const readLine = createInterface({ input: fileStream, crlfDelay: Infinity })
    let startFound = false
    const result: string[] = [];
    for await (const line of readLine) {
        if (line.includes("PreloadEnd")) {
            break;
        }

        if (startFound) {
            result.push(line);
        }

        if (line.includes("PreloadStart")) {
            startFound = true
        }
    }
    fileStream.close();

    return result;
}

function filterPreloadCalls(preloadLines: string[]): string[] {
    return preloadLines.map(it => {
        preloadRegex.lastIndex = 0;
        const result = preloadRegex.exec(it)
        return result?.groups?.content
    }).map(it => (it == null) ? "" : it);
}

async function writeLinesToFile(lines: string[], outputPath: string, eol: string) {
    await writeFile(outputPath, lines.join(eol));
}

async function readFileLines(inputPath: string) {
    const fileStream = createReadStream(inputPath);
    const readLine = createInterface({ input: fileStream, crlfDelay: Infinity })
    const result: string[] = [];
    for await (const line of readLine) {
        result.push(line);
    }
    return result;
}

function compilePreloadContent(preloadFunction: string, lines: string[]) {
    const result: string[] = [];
    result.push(`function ${preloadFunction} takes nothing returns nothing`);
    result.push(`\tcall PreloadStart()`);
    lines.forEach(it => result.push(`\tcall Preload("${it}")`));
    result.push(`\tcall PreloadEnd(0.0)`);
    result.push(`endfunction`);
    return result
}

export const PreloadConverter = {
    async parsePreloadFile(inputPath: string, outputPath: string) {
        log.info(`Converting '${inputPath}' to '${outputPath}'`);
        const preloadLines = await extractPreloadLines(inputPath);
        log.info(`Found ${preloadLines.length} lines.`);
        await writeLinesToFile(filterPreloadCalls(preloadLines), outputPath, EOL);
        log.info(`Exported preload content to '${outputPath}'`);
    },

    async compilePreloadFile(inputPath: string, outputPath: string, preloadFunction: string) {
        log.info(`Compiling '${inputPath}' to '${outputPath}'`);
        const content = await readFileLines(inputPath);
        log.info(`Found ${content.length} lines.`);
        await writeLinesToFile(compilePreloadContent(preloadFunction, content), outputPath, '\r\n');
        log.info(`Compiled file content into '${outputPath}' preload file.`)

    }
}