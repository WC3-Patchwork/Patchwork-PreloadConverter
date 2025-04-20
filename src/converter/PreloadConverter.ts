import { createReadStream, createWriteStream } from "fs";
import { LoggerFactory } from "../logging/LoggerFactory";
import { createInterface } from "readline";

const log = LoggerFactory.createLogger("PreloadConverter");

const preloadRegex = /call Preload\((?<content>.*)\)/gm;

async function extractPreloadLines(inputPath: string): Promise<string[]> {
    const fileStream = createReadStream(inputPath);
    const readLine = createInterface({ input: fileStream, crlfDelay: Infinity })
    let lineNumber = 0;
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

        lineNumber++;
    }

    return result;
}

function filterPreloadCalls(preloadLines: string[]): string[] {
    return preloadLines.map(it => preloadRegex.exec(it)?.groups?.content).map(it => (it == null) ? "" : it);
}

function writeLinesToFile(lines: string[], outputPath: string) {
    const output = createWriteStream(outputPath);
    for (const line in lines) {
        output.write(line);
        output.write('\n');
    }
}

export const PreloadConverter = {
    async convertPreloadFile(inputPath: string, outputPath: string) {
        log.info(`Converting '${inputPath}' to '${outputPath}'`);
        const preloadLines = await extractPreloadLines(inputPath);
        log.info(`Found ${preloadLines.length} lines.`);
        const contentLines = filterPreloadCalls(preloadLines);
        writeLinesToFile(contentLines, outputPath);
        log.info(`Exported preload content to '${outputPath}'`);
    }
}