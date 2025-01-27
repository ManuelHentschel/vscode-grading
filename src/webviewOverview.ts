import { getCssAndJsLine } from "./webview";
import * as vscode from "vscode";

export async function makeOverviewHtml(panel: vscode.WebviewPanel): Promise<string> {
    const cssAndJs = getCssAndJsLine(panel, 'overview.css', 'overview.js');
    const html = cssAndJs + 'Hello world!\nThis is an overview page.';
    return html;
}