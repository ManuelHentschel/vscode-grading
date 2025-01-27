import { HTMLBody, HTMLHeadedSection, HTMLHeading } from "./html";
import { getCssAndJsLine } from "./webview";
import * as vscode from "vscode";

export async function makeOverviewHtml(panel: vscode.WebviewPanel): Promise<string> {
    const cssAndJs = getCssAndJsLine(panel, 'overview.css', 'overview.js');
    const bodyParts = [
        cssAndJs,
        new HTMLHeading(1, 'Overview'),
        'Hello world!',
        makeConfigSection()
    ];
    const body = new HTMLBody(bodyParts);
    const html = body.toString();
    return html;
}

function makeConfigSection(): HTMLHeadedSection {
    return new HTMLHeadedSection(
        2,
        'Configuration',
        [
            'This is the configuration section.<br>',
            'It will contain the configuration options.'
        ]
    );
}
