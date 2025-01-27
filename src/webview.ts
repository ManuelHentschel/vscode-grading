
import * as vscode from 'vscode';
import { OutMessage } from '../html/webviewMessages';
import { getContext } from './extension';
import { handleMouseClickMessage, makeTableHtml, TableType } from './webviewTables';
import { getConfig } from './readConfig';
import { makeOverviewHtml } from './webviewOverview';

export type WebviewType = `grading.table.${TableType}` | 'grading.overview';

function isTableType(type: WebviewType): type is `grading.table.${TableType}` {
    return type.startsWith('grading.table.');
}

const webviewMap = new Map<WebviewType, vscode.WebviewPanel>();

export async function openTableWebview(type: TableType): Promise<void> {
    const webviewType = `grading.table.${type}` as WebviewType;
    openWebview(webviewType);
}

export async function openWebview(type: WebviewType): Promise<void> {
    const panel = getWebviewPanel(type);
    if(isTableType(type)){
        panel.webview.html = await makeTableHtml(type, panel);
    } else {
        panel.webview.html = await makeOverviewHtml(panel);
    }
    panel.reveal();
    console.log('Html sent to webview, type: ', panel.viewType);
}


function getWebviewPanel(type: WebviewType): vscode.WebviewPanel {
    const openWebview = webviewMap.get(type);
    if(openWebview){
        return openWebview;
    }
    let title: string;
    if(type === 'grading.table.points'){
        title = 'Points';
    } else if(type === 'grading.table.present'){
        title = 'Present';
    } else if(type === 'grading.table.graded'){
        title = 'Graded';
    } else {
        title = 'Grading';
    }
    const newWebview = vscode.window.createWebviewPanel(
        type,
        title,
        vscode.ViewColumn.Active,
        {enableScripts: true}
    );
    newWebview.onDidDispose(() => {webviewMap.delete(type);});
    webviewMap.set(type, newWebview);
    newWebview.webview.onDidReceiveMessage((e) => handleWebviewMessage(newWebview, e));
    return newWebview;
}

export async function refreshWebviews(): Promise<void> {
    for(const [type, panel] of webviewMap.entries()){
        if(isTableType(type)){
            panel.webview.html = await makeTableHtml(type, panel);
        } else if(type === 'grading.overview'){
            panel.webview.html = await makeOverviewHtml(panel);
        } else {
            console.log('Unknown webview type: ', type);
        }
    }
}

function handleWebviewMessage(panel: vscode.WebviewPanel, message: OutMessage): void {
    // console.log('Received message in webview.ts:');
    // console.log(message);
    if(message.message === 'mouseClick'){
        void handleMouseClickMessage(panel, message);
    } else if(message.message === 'log'){
        console.log(`Webview log. Type: ${panel.viewType}. Message: ${message.body}`);
    }
}


export function getCssAndJsLine(
    panel: vscode.WebviewPanel,
    cssPath: string = 'theme.css',
    jsPath: string = 'script.js'
): string {
    const context = getContext();
    const webviewStyleUri = vscode.Uri.joinPath(context.extensionUri, 'html',cssPath);
    const webviewScriptUri = vscode.Uri.joinPath(context.extensionUri, 'html', jsPath);
    const styleUri = panel.webview.asWebviewUri(webviewStyleUri);
    const scriptUri = panel.webview.asWebviewUri(webviewScriptUri);
    const ret = [
        `<script src="${scriptUri.toString(true)}" type="module"></script>`,
        `<link rel="stylesheet" href="${styleUri.toString(true)}"></link>`
    ].join('\n');
    return ret;
}

export function pointsToString(points: number | undefined): string {
    if(points === undefined){
        const config = getConfig();
        return config.get('comment.pointsPlaceHolder', '???');
    }
    return points.toLocaleString('en', { minimumFractionDigits: 1 });
}

