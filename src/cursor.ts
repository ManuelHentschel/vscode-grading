
import * as vscode from 'vscode';
import { MatchedExercise, ParsedExercise, PointComment } from './types';
import { getDocTracker } from './docTracker';
import { findContainingExercise, findContainingParsedExercise } from './parseDocument';
import { changePoints } from './modifyDocs';
import { getConfig } from './readConfig';


export async function incrementAtCursor(inc?: number, negative: boolean = false): Promise<undefined> {
    const config = getConfig();
    if(inc === undefined){
        inc = config.get('codeLens.pointSteps', 1);
    }
    if(negative){
        inc *= -1;
    }
    changePointsAtCursor(inc, true);
    return;
}

export async function changePointsAtCursor(newScore: number | undefined, isDiff: boolean, isSnippet?: boolean): Promise<undefined> {
    const editor = vscode.window.activeTextEditor;
    if(!editor){
        return;
    }
    const doc = editor.document;
    const pos = editor.selection.active;
    await changePointsAtPos(doc, pos, newScore, isDiff, isSnippet);
}

export function getExAtCursor(refresh = true): (
    [MatchedExercise, ParsedExercise]
    | [undefined, ParsedExercise]
    | [undefined, undefined]
) {
    const editor = vscode.window.activeTextEditor;
    if(!editor){
        return [undefined, undefined];
    }
    const cursor = editor.selection.active;
    return getExAtPosition(editor.document, cursor, refresh);
}

export async function changePointsAtPos(
    doc: vscode.TextDocument,
    pos: vscode.Position,
    newScore: number | undefined,
    isDiff: boolean,
    isSnippet?: boolean,
): Promise<undefined> {
    const [mex, pex] = getExAtPosition(doc, pos);
    if(!mex){
        return;
    }
    const mdoc = getDocTracker().getMatchedDoc(doc);
    if(!mdoc){
        return;
    }
    await changePoints(newScore, isDiff, mdoc, mex, pex, undefined, isSnippet);
}

export function getExAtPosition(doc: vscode.TextDocument, pos: vscode.Position, refresh = true): (
    [MatchedExercise, ParsedExercise]
    | [undefined, ParsedExercise]
    | [undefined, undefined]
) {
    const matchedDoc = getDocTracker().getMatchedDoc(doc, refresh);
    if(!matchedDoc){
        return [undefined, undefined];
    }
    const [mex, pex] = findContainingExercise(matchedDoc.exercises, pos);
    if(mex){
        return [mex, pex];
    }
    const unmatchedPex = findContainingParsedExercise(matchedDoc.unmatchedExercises, pos);
    return [undefined, unmatchedPex];
}



