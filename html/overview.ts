import { VsCode } from './webviewMessages';

declare function acquireVsCodeApi(): VsCode;

const vscode = acquireVsCodeApi();

window.onload = function () {
    vscode.postMessage({
        message: 'log',
        body: 'Overview page loaded'
    });
};
