import { findUris, getGlobMatches } from "./export";
import { HTMLBody, HTMLCode, HTMLDiv, HTMLElement, HTMLHeadedSection, HTMLHeading, HTMLLink, HTMLList } from "./html";
import { makeComment } from "./modifyDocs";
import { getConfig, getExNames, getParsePatterns } from "./readConfig";
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
            makeCommentConfigBlock()
        ]
    );
}

function makeCommentConfigBlock(): HTMLElement {
    const ret = new HTMLDiv(['Something about comments'], 'commentConfigBlock');
    ret.content.push(
        makeConfigEntry('comment.template'),
        makeConfigEntry('comment.regex'),
    )
    const parsePatterns = getParsePatterns();
    const re = parsePatterns.comment;
    const exampleString = 'This is an example comment';
    ret.content.push('Example string:', exampleString, '<br>');
    const fromTemplate = makeComment(exampleString);
    ret.content.push('Comment from template:', fromTemplate, '<br>');
    const match = re.exec(fromTemplate);
    if(match){
        ret.content.push('Match:', match[0], '<br>');
    } else {
        ret.content.push('Regex does not match!<br>');
    }
    return ret;
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
    const globDiv = new HTMLDiv([
        makeConfigEntry('examFiles.globPattern'),
        `${globUris.length} files found by glob pattern.<br>`,
    ], 'globDiv');
    htmlElements.push(globDiv);

    const exDiv = new HTMLDiv([
        makeConfigEntry('examFiles.pattern'),
    ], 'exDiv');

    if(exPaths.length === 0){
        exDiv.content.push('No exams found');
    } else {
        const exList = new HTMLList(exPaths);
        exList.id = 'exList';
        exList.classes.push('fileList');
        exDiv.content.push(new HTMLDiv([
            'Exams found:<br>',
            exList
        ]));
    }
    htmlElements.push(exDiv);

    const solDiv = new HTMLDiv([], 'solDiv');
    const solUris = await findUris(true, true);
    const solPaths = solUris.map(uri => vscode.workspace.asRelativePath(uri));
    solDiv.content.push(makeConfigEntry('examFiles.solutionFiles'));
    if(solPaths.length === 0){
        solDiv.content.push('No solutions found');
    } else {
        const solList = new HTMLList(solPaths);
        solList.id = 'solList';
        solList.classes.push('fileList');
        solDiv.content.push(new HTMLDiv([
            'Solutions found:<br>',
            solList
        ]));
    }
    htmlElements.push(solDiv);

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
    const configList = new HTMLList(configEntries);
    configList.id = 'generalConfigList';
    return new HTMLHeadedSection(
        2,
        'Config - General',
        [
            'The following general configuration entries influence the behavior of the extension.<br>',
            'Click on the corresponding link to see details and change the value.<br>',
            configList
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

    const link = new HTMLLink(uri.toString(), new HTMLCode(configName));
    const line = new HTMLDiv([
        link,
        ':',
        new HTMLCode(configValueToString(value))
    ]);
    line.attributes.class = 'configEntry';

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
