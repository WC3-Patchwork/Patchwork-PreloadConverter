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

async function writeLinesToFile(lines: string[], outputPath: string) {
    await writeFile(outputPath, lines.join(EOL));
}

export const PreloadConverter = {
    async convertPreloadFile(inputPath: string, outputPath: string) {
        log.info(`Converting '${inputPath}' to '${outputPath}'`);
        const preloadLines = await extractPreloadLines(inputPath);
        log.info(`Found ${preloadLines.length} lines.`);
        const contentLines = filterPreloadCalls(preloadLines);
        await writeLinesToFile(contentLines, outputPath);
        log.info(`Exported preload content to '${outputPath}'`);
    }
}