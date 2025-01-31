import { HTMLBody, HTMLDiv, HTMLElement, HTMLHeadedSection, HTMLHeading, HTMLLink } from "./html";
import { getConfig } from "./readConfig";
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
        makeExamConfigSection(),
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

function makeExamConfigSection(): HTMLHeadedSection {
    return new HTMLHeadedSection(
        2,
        'Config - Exam',
        [
            'The following configuration entries influence the identification of exams and solution files.<br>',
            'Click on the corresponding link to see details and change the value.<br>',
        ]
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
    const commandName = 'openWorkspaceSettings';

    const commandArgs = encodeURIComponent(JSON.stringify([fullConfigName]));
    const uri = vscode.Uri.parse(`command:workbench.action.${commandName}?${commandArgs}`);

    // const commandDescription = configEntry.

    const link = new HTMLLink(uri.toString(), configName);
    const line = new HTMLDiv([
        link,
        ':',
        String(value)
    ]);

    return line;
}
