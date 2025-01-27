import * as vscode from 'vscode';
import { CellClickMessage } from '../html/webviewMessages';
import { getDocTracker } from './docTracker';
import { mDocsToExercises, parseAllFiles } from './export';
import { HTMLCell, HTMLPointsCell, HTMLRow, HTMLTable, HTMLYesNoCell } from './html';
import { getConfig, getConfigExercises, makeFlatExercises } from './readConfig';
import * as types from './types';
import { arraySum } from './utils';
import { getCssAndJsLine, WebviewType } from './webview';

export type TableType = 'points' | 'present' | 'graded';

type CellIdExerciseMap = Map<string, [string, types.MatchedExercise | undefined]>;

let cellIdMaps = new Map<vscode.WebviewPanel, CellIdExerciseMap>();

function webviewTypeToTableType(webviewType: WebviewType): TableType {
    return webviewType.split('.')[2] as TableType;
}


export async function handleMouseClickMessage(panel: vscode.WebviewPanel, message: CellClickMessage): Promise<void> {
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

export async function makeTableHtml(webviewType: WebviewType = 'grading.table.points', panel: vscode.WebviewPanel): Promise<string> {
    const tableType = webviewTypeToTableType(webviewType);
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
            const cell = makeCell(ex, id, tableType);
            if (cell.id) {
                cellIdMap.set(cell.id, [id, ex]);
            }
            return cell;
        });
        const idCell = makeIdCell(id);
        cells.unshift(idCell);
        if (idCell.id) {
            cellIdMap.set(idCell.id, [id, undefined]);
        }
        if (tableType === 'points') {
            cells.push(makeTotalCell(id, total));
        } else if (tableType === 'present') {
            const allPresent = nestedExs.reduce((pv, ex) => exIsPresent(ex) && pv, true);
            cells.push(makeTotalYesNoCell(id, allPresent));
        } else if (tableType === 'graded') {
            const allGraded = nestedExs.reduce((pv, ex) => exIsGraded(ex) && pv, true);
            cells.push(makeTotalYesNoCell(id, allGraded));
        }
        entries.push(cells);
    }
    cellIdMaps.set(panel, cellIdMap);
    panel.onDidDispose(() => { cellIdMaps.delete(panel); });
    const rows = entries.map(rowEntries => new HTMLRow(rowEntries));
    const headerCells = ['Id', ...colnames, 'Total'].map(s => makeHeaderCell(s));
    const headerRow = new HTMLRow(headerCells);
    const tableRows = [headerRow, ...rows];
    const table = new HTMLTable(tableRows);
    table.id = 'table';
    const html = getCssAndJsLine(panel) + table.toString();
    return html;
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
