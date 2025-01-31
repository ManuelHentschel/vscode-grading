import { findUris, getGlobMatches } from "./export";
import { HTMLBody, HTMLDiv, HTMLElement, HTMLHeadedSection, HTMLHeading, HTMLLink } from "./html";
import { getConfig, getExNames } from "./readConfig";
import { getErrorMessage } from "./utils";
import { getCssAndJsLine } from "./webview";
import * as vscode from "vscode";

export async function makeOverviewHtml(panel: vscode.WebviewPanel): Promise<string> {
    const cssAndJs = getCssAndJsLine(panel, 'overview.css', 'overview.js');
    const bodyParts = [
        cssAndJs,
        new HTMLHeading(1, 'Overview'),
        'Hello world!',
        makeExercisesSection(),
        makeCommentsConfigSection(),
        await makeExamConfigSection(),
        makeGeneralConfigSection()
    ];
    const body = new HTMLBody(bodyParts);
    const html = body.toString();
    return html;
}

function makeExercisesSection(): HTMLHeadedSection {
    return new HTMLHeadedSection(
        2,
        'Exercises',
        [
            'This is the exercises section.<br>',
            'It will contain the exercises.<br>'
        ]
    );
}

function makeCommentsConfigSection(): HTMLHeadedSection {
    return new HTMLHeadedSection(
        2,
        'Config - Comments',
        [
            'This is the comments config section.<br>',
            'It will contain the comments config options.<br>',
        ]
    );
}

async function makeExamConfigSection(): Promise<HTMLHeadedSection> {
    // Make html elements for the config entries
    const htmlElements: (HTMLElement | string)[] = [
        'The following configuration entries influence the identification of exams and solution files.<br>',
        'Click on the corresponding link to see details and change the value.<br>',
    ];

    // Check if the examFiles.pattern is a valid regex
    const config = getConfig();
    const pattern = config.get('examFiles.pattern', '');
    // Add the found exercises and solutions to the html
    const globUris = await getGlobMatches();
    const exUris = await findUris();
    const exPaths = exUris.map(uri => vscode.workspace.asRelativePath(uri));
    htmlElements.push(new HTMLDiv([
        makeConfigEntry('examFiles.globPattern'),
        `${globUris.length} files found by glob pattern.<br>`,
        makeConfigEntry('examFiles.pattern'),
    ]));
    if(exPaths.length === 0){
        htmlElements.push('No exercises found');
    } else {
        htmlElements.push(new HTMLDiv([
            'Exercises found:<br>',
            exPaths.join('<br>')
        ]));
    }
    const solUris = await findUris(true, true);
    const solPaths = solUris.map(uri => vscode.workspace.asRelativePath(uri));
    htmlElements.push(makeConfigEntry('examFiles.solutionFiles'));
    if(solPaths.length === 0){
        htmlElements.push('No solutions found');
    } else {
        htmlElements.push(new HTMLDiv([
            'Solutions found:<br>',
            solPaths.join('<br>')
        ]));
    }

    return new HTMLHeadedSection(
        2,
        'Config - Exam Files',
        htmlElements
    );
}

function makeGeneralConfigSection(): HTMLHeadedSection {
    const configEntries = [
        'webview.selectExerciseOnClick',
        'typeDelay',
        'keybindings.enable',
        'codeLens.showCodeLenses',
        'deco.showDebugInfo',
        'deco.exerciseBackground',
        'confirmModifications',
        'allowMultiplePointsComments',
        'allowMultipleParsedExercises',
    ].map(makeConfigEntry);
    return new HTMLHeadedSection(
        2,
        'Config - General',
        [
            'The following general configuration entries influence the behavior of the extension.<br>',
            'Click on the corresponding link to see details and change the value.<br>',
            ...configEntries
        ]
    );
}

function makeConfigEntry(configName: string): HTMLElement {
    const config = getConfig();
    const configEntry = config.inspect(configName);
    if(!configEntry){
        return new HTMLElement('p', ['No config found for ', configName]);
    }
    const fullConfigName = configEntry.key;
    const value = config.get(configName);

    // const setInWorkspace = configEntry?.workspaceValue !== undefined;
    // const commandName = setInWorkspace ? 'openWorkspaceSettings' : 'openSettings';
    // const commandArgs = encodeURIComponent(JSON.stringify([fullConfigName]));
    // const uri = vscode.Uri.parse(`command:workbench.action.${commandName}?${commandArgs}`);

    const uri = makeCommandUri('workbench.action.openWorkspaceSettings', fullConfigName);

    // const commandDescription = configEntry.

    const link = new HTMLLink(uri.toString(), configName);
    const line = new HTMLDiv([
        link,
        ':',
        configValueToString(value)
    ]);

    return line;
}

function configValueToString(value: unknown): string {
    if(Array.isArray(value)){
        return `[${value.map(configValueToString).join(', ')}]`;
    }
    if(typeof value === 'string'){
        return `"${value}"`;
    }
    return String(value);
}

function makeCommandUri(command: string, ...args: unknown[]): vscode.Uri {
    const commandArgs = encodeURIComponent(JSON.stringify(args));
    return vscode.Uri.parse(`command:${command}?${commandArgs}`);
}
