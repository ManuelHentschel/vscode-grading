import * as vscode from 'vscode';

export function openOverviewWebview(): void {
    const panel = vscode.window.createWebviewPanel(
        'overview',
        'Overview',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getWebviewContent();
}

function getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Overview</title>
            <link rel="stylesheet" href="${vscode.Uri.file(
                vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'html', 'overview.css').fsPath
            )}">
        </head>
        <body>
            <h1>Overview</h1>
            <div id="config">
                <h2>Config</h2>
                <p id="config-content">Loading...</p>
            </div>
            <div id="exam-files">
                <h2>Exam Files</h2>
                <p id="exam-files-content">Loading...</p>
            </div>
            <div id="solution-files">
                <h2>Solution Files</h2>
                <p id="solution-files-content">Loading...</p>
            </div>
            <div id="template-config">
                <h2>Template Config Entries</h2>
                <p id="template-config-content">Loading...</p>
            </div>
            <div id="identified-exams">
                <h2>Identified Exams</h2>
                <p id="identified-exams-content">Loading...</p>
            </div>
            <div id="points-tables">
                <h2>Points Tables</h2>
                <p id="points-tables-content">Loading...</p>
            </div>
            <script src="${vscode.Uri.file(
                vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'html', 'overview.js').fsPath
            )}"></script>
        </body>
        </html>
    `;
}
