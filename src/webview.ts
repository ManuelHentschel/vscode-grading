
import * as vscode from 'vscode';
import * as types from './types';
import { mDocsToExercises, parseAllFiles } from './export';
import { getConfig, getConfigExercises, makeFlatExercises } from './readConfig';
import { arraySum } from './utils';
import { getContext } from './extension';
import { HTMLCell, HTMLElement, HTMLPointsCell, HTMLRow, HTMLTable, HTMLYesNoCell } from './html';
import { CellClickMessage, OutMessage } from '../html/webviewMessages';
import { getDocTracker } from './docTracker';

type TableType = 'points' | 'present' | 'graded';

type WebviewType = `grading.table.${TableType}`;

type CellIdExerciseMap = Map<string, [string, types.MatchedExercise | undefined]>;

let cellIdMaps = new Map<vscode.WebviewPanel, CellIdExerciseMap>();

const webviewMap = new Map<TableType, vscode.WebviewPanel>();
function getWebviewPanel(type: TableType): vscode.WebviewPanel {
    const openWebview = webviewMap.get(type);
    if(openWebview){
        return openWebview;
    }
    const webviewType: WebviewType = `grading.table.${type}`;
    let title: string;
    if(type === 'points'){
        title = 'Points';
    } else if(type === 'present'){
        title = 'Present';
    } else if(type === 'graded'){
        title = 'Graded';
    } else {
        title = 'Grading';
    }
    const newWebview = vscode.window.createWebviewPanel(
        webviewType,
        title,
        vscode.ViewColumn.Active,
        {enableScripts: true}
    );
    newWebview.onDidDispose(() => {webviewMap.delete(type);});
    webviewMap.set(type, newWebview);
    newWebview.webview.onDidReceiveMessage((e) => handleWebviewMessage(newWebview, e));
    return newWebview;
}

export async function openWebview(type: TableType): Promise<void> {
    const panel = getWebviewPanel(type);
    const html = await makeHtml(type, panel);
    panel.webview.html = html;
    panel.reveal();
    console.log('Html sent to webview.');
}

export async function refreshWebviews(): Promise<void> {
    for(const [type, panel] of webviewMap.entries()){
        const html = await makeHtml(type, panel);
        panel.webview.html = html;
    }
}

function handleWebviewMessage(panel: vscode.WebviewPanel, message: OutMessage): void {
    // console.log('Received message in webview.ts:');
    // console.log(message);
    if(message.message === 'mouseClick'){
        void handleMouseClickMessage(panel, message);
    } else if(message.message === 'log'){
        console.log(message.body);
    }
}

async function handleMouseClickMessage(panel: vscode.WebviewPanel, message: CellClickMessage): Promise<void> {
    if(message.button !== 0 || !message.ctrlKey){
        return;
    }
    const idEx = cellIdMaps.get(panel)?.get(message.cellId);
    if(!idEx){
        console.log('No exercise found for cellId: ' + message.cellId);
        return;
    }
    const [id, ex] = idEx;
    let selection: vscode.Range | undefined;
    let doc: vscode.TextDocument;
    const selectAll = getConfig().get('webview.selectExerciseOnClick', true);
    if(!ex){
        const trackedDoc = getDocTracker().getTDocForId(id)[0];
        if(!trackedDoc){
            vscode.window.showWarningMessage(`No document found for ${id}`);
            return;
        }
        doc = trackedDoc.doc;
        selection = undefined;
    } else {
        if(ex.parsedExercises.length > 1){
            vscode.window.showWarningMessage(`Multiple exercises found for ${id}.${ex.name}. Going to first.`);
        }
        const parsedEx = ex.parsedExercises[0];
        if(!parsedEx){
            vscode.window.showWarningMessage(`No exercise found for ${id}.${ex.name}`);
            return;
        }
        doc = parsedEx.document;
        selection = parsedEx.range;
        if(!selectAll){
            selection = new vscode.Range(selection.start, selection.start);
        }
    }
    const editor = await vscode.window.showTextDocument(
        doc,
        {
            preview: true,
            viewColumn: vscode.ViewColumn.One,
            selection: selection
        }
    );
    if(selection){
        editor.revealRange(selection, vscode.TextEditorRevealType.AtTop);
    }
}




async function makeHtml(type: TableType = 'points', panel: vscode.WebviewPanel): Promise<string> {
    const allFiles = await parseAllFiles();
    const nestedExam = getConfigExercises();
    const exam = makeFlatExercises(nestedExam);
    const colnames = exam.map(ex => ex.name);
    const entries: HTMLCell[][] = [];
    const cellIdMap = new Map<string, [string, types.MatchedExercise | undefined]>();
    for (const [id, mdocs] of allFiles) {
        const nestedExs = mDocsToExercises(mdocs);
        const total = arraySum(nestedExs.map(ex => ex.achievedTotalPoints));
        const flatExs = makeFlatExercises(nestedExs);
        const cells = flatExs.map(ex => {
            const cell = makeCell(ex, id, type);
            if(cell.id){
                cellIdMap.set(cell.id, [id, ex]);
            }
            return cell;
        });
        const idCell = makeIdCell(id);
        cells.unshift(idCell);
        if(idCell.id){
            cellIdMap.set(idCell.id, [id, undefined]);
        }
        if(type === 'points'){
            cells.push(makeTotalCell(id, total));
        } else if(type === 'present'){
            const allPresent = nestedExs.reduce((pv, ex) => exIsPresent(ex) && pv, true);
            cells.push(makeTotalYesNoCell(id, allPresent));
        } else if(type === 'graded'){
            const allGraded = nestedExs.reduce((pv, ex) => exIsGraded(ex) && pv, true);
            cells.push(makeTotalYesNoCell(id, allGraded));
        }
        entries.push(cells);
    }
    cellIdMaps.set(panel, cellIdMap);
    panel.onDidDispose(() => {cellIdMaps.delete(panel);});
    const rows = entries.map(rowEntries => new HTMLRow(rowEntries));
    const headerCells = ['Id', ...colnames, 'Total'].map(s => makeHeaderCell(s));
    const headerRow = new HTMLRow(headerCells);
    const tableRows = [headerRow, ...rows];
    const table = new HTMLTable(tableRows);
    table.id = 'table';
    const html = getCssAndJsLine(panel) + table.toString();
    return html;
}

function getCssAndJsLine(panel: vscode.WebviewPanel): string {
    const context = getContext();
    const webviewStyleUri = vscode.Uri.joinPath(context.extensionUri, './html/theme.css');
    const webviewScriptUri = vscode.Uri.joinPath(context.extensionUri, './html/script.js');
    const styleUri = panel.webview.asWebviewUri(webviewStyleUri);
    const scriptUri = panel.webview.asWebviewUri(webviewScriptUri);
    const ret = [
        `<script src="${scriptUri.toString(true)}" type="module"></script>`,
        `<link rel="stylesheet" href="${styleUri.toString(true)}"></link>`
    ].join('\n');
    return ret;
}

function makeCell(ex: types.MatchedExercise, id: string, type: TableType): HTMLCell {
    if(type === 'points'){
        return makePointsCell(ex, id);
    } else if(type === 'present'){
        return makeIsPresentCell(ex, id);
    } else if(type === 'graded'){
        return makeIsGradedCell(ex, id);
    } else {
        throw new Error('Unknown cell type: ' + type);
    }
}

function makeIsPresentCell(ex: types.MatchedExercise, id: string): HTMLYesNoCell {
    const cell = new HTMLYesNoCell(exIsPresent(ex));
    cell.id = `cell.present.${id}.${ex.id}`;
    return cell;
}

function makeIsGradedCell(ex: types.MatchedExercise, id: string): HTMLYesNoCell {
    const cell = new HTMLYesNoCell(exIsGraded(ex));
    cell.id = `cell.graded.${id}.${ex.id}`;
    return cell;
}

function makePointsCell(ex: types.MatchedExercise, id: string): HTMLCell {
    const cell = new HTMLPointsCell(ex.achievedTotalPoints, ex.totalPoints);
    cell.id = `cell.points.${id}.${ex.id}`;
    if(ex.atomicPoints === 0 && ex.subExercises.length > 0){
        cell.classes.push('parentExercise');
    }
    cell.classes.push(exIsGraded(ex) ? 'isGraded' : 'notGraded');
    cell.classes.push(exIsPresent(ex) ? 'isPresent' : 'notPresent');

    return cell;
}

function makeHeaderCell(content: string): HTMLCell {
    const cell = new HTMLCell(true);
    cell.content = [content];
    cell.id = `cell.header.${content.replace(' ', '_')}`;
    cell.classes.push('headerCell');
    return cell;
}
function makeIdCell(id: string): HTMLCell {
    const cell = new HTMLCell();
    cell.id = `cell.${id}.id`;
    cell.classes.push('idCell');
    cell.content.push(id);
    return cell;
}
function makeTotalYesNoCell(id: string, yes: boolean): HTMLYesNoCell {
    const cell = new HTMLYesNoCell(yes);
    cell.id = `cell.${id}.total`;
    cell.classes.push('totalCell');
    return cell;
}

function makeTotalCell(id: string, achievedTotal: number, total?: number): HTMLCell {
    const cell = new HTMLPointsCell(achievedTotal, total);
    cell.id = `cell.${id}.total`;
    cell.classes.push('totalCell');
    return cell;
}

export function pointsToString(points: number | undefined): string {
    if(points === undefined){
        const config = getConfig();
        return config.get('comment.pointsPlaceHolder', '???');
    }
    return points.toLocaleString('en', {minimumFractionDigits: 1});
}

export function exIsPresent(ex: types.MatchedExercise): boolean {
    return ex.parsedExercises.length > 0;
}
export function exIsGraded(ex: types.MatchedExercise): boolean {
    const hasPointsComments = ex.pointsComments.filter(pc => !pc.isPlaceHolder).length > 0;
    if(ex.atomicPoints > 0 && !hasPointsComments){
        return false;
    }
    return ex.subExercises.reduce((pv, ex) => exIsGraded(ex) && pv, true);
}
