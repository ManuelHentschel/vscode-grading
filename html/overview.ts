import { VsCode } from './webviewMessages';

declare function acquireVsCodeApi(): VsCode;

const vscode = acquireVsCodeApi();

window.onload = function () {
    vscode.postMessage({
        message: 'log',
        body: 'Overview page loaded'
    });

    // Fetch and display relevant config
    vscode.postMessage({ message: 'getConfig' });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setConfig') {
            document.getElementById('config-content').innerText = message.config;
        }
    });

    // Fetch and display exam files
    vscode.postMessage({ message: 'getExamFiles' });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setExamFiles') {
            document.getElementById('exam-files-content').innerText = message.examFiles;
        }
    });

    // Fetch and display solution files
    vscode.postMessage({ message: 'getSolutionFiles' });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setSolutionFiles') {
            document.getElementById('solution-files-content').innerText = message.solutionFiles;
        }
    });

    // Fetch and display template config entries
    vscode.postMessage({ message: 'getTemplateConfig' });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setTemplateConfig') {
            document.getElementById('template-config-content').innerText = message.templateConfig;
        }
    });

    // Fetch and display identified exams
    vscode.postMessage({ message: 'getIdentifiedExams' });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setIdentifiedExams') {
            document.getElementById('identified-exams-content').innerText = message.identifiedExams;
        }
    });

    // Fetch and display points tables
    vscode.postMessage({ message: 'getPointsTables' });
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'setPointsTables') {
            document.getElementById('points-tables-content').innerText = message.pointsTables;
        }
    });
};
