
import * as vscode from 'vscode';
import { parseAndMatchDoc } from './parseDocument';
import { getConfig, makeFlatExercises } from './readConfig';
import { pointsToString } from './webview';
import { verifyDocument, getDocTracker, getVisibleEditors } from './docTracker';
import { findUris } from './export';
import { Exercise, MatchedDocument, MatchedExercise, ParsedExercise, PointComment } from './types';

export async function normalizePointsForAll(): Promise<boolean> {
    const uris = await findUris();
    const docs = await Promise.all(uris.map(vscode.workspace.openTextDocument));
    const edit = new vscode.WorkspaceEdit();
    for(const doc of docs){
        normalizePoints(doc, edit);
    }
    console.log(`Edit size: ${edit.size}`);
    if(edit.size === 0){
        vscode.window.showInformationMessage('No changes needed!');
        return false;
    }
    const ret = await vscode.workspace.applyEdit(edit);
    getDocTracker().handleChangeTextDocument();
    return ret;
}

export async function normalizePointsForActive(): Promise<void> {
    const doc = vscode.window.activeTextEditor?.document;
    const id = verifyDocument(doc);
    if(!doc || !id){
        vscode.window.showErrorMessage('No active document/doc not valid!');
        return;
    }
    const edit = new vscode.WorkspaceEdit();
    normalizePoints(doc, edit);
    const ret = await vscode.workspace.applyEdit(edit);
    getDocTracker().handleChangeTextDocument();
}

export function normalizePoints(doc: vscode.TextDocument, edit: vscode.WorkspaceEdit): boolean {
    const config = getConfig();
    const needsConfirmation = config.get<boolean>('confirmModifications', true);
    const docTracker = getDocTracker();
    const mDoc = docTracker.handleDoc(doc)?.matchedDoc;
    if(!mDoc){
        return false;
    }
    const exercises = makeFlatExercises(mDoc.exercises);
    for(const ex of exercises){
        for(const pc of ex.pointsComments){
            const score = pc.isPlaceHolder ? undefined : pc.pointsScore;
            const newContent = makePointsCommentContent(score, ex.atomicPoints, pc.remark.text, config);
            const newTxt = makeComment(newContent, config);
            if(newTxt !== pc.text){
                edit.replace(doc.uri, pc.range, newTxt, {
                    needsConfirmation: needsConfirmation,
                    label: 'Normalize Points Comments'
                });
            }
        }
    }
    return true;
}

export async function addPointsCommentsForAll(): Promise<boolean> {
    const uris = await findUris();
    const docs = await Promise.all(uris.map(vscode.workspace.openTextDocument));
    const edit = new vscode.WorkspaceEdit();
    for(const doc of docs){
        addPointsComments(doc, edit);
    }
    console.log(`Edit size: ${edit.size}`);
    if(edit.size === 0){
        vscode.window.showInformationMessage('No changes needed!');
        return false;
    }
    const ret = await vscode.workspace.applyEdit(edit);
    getDocTracker().handleChangeTextDocument();
    return ret;
}

export function addPointsComments(doc: vscode.TextDocument, edit: vscode.WorkspaceEdit): boolean {
    const config = getConfig();
    const docTracker = getDocTracker();
    const mDoc = docTracker.handleDoc(doc)?.matchedDoc;
    if(!mDoc){
        return false;
    }
    const exercises = makeFlatExercises(mDoc.exercises);
    for(const ex of exercises){
        if(ex.atomicPoints === 0 || ex.pointsComments.length > 0){
            continue;
        }
        ex.parsedExercises.forEach(parsedEx => addPointsComment(ex, parsedEx, edit, config));
    }
    return true;
}

export function addPointsComment(
    ex: Exercise,
    parsedEx: ParsedExercise,
    edit: vscode.WorkspaceEdit,
    config?: vscode.WorkspaceConfiguration
): void {
    config ||= getConfig();
    const needsConfirmation = config.get<boolean>('confirmModifications', true);
    const rng = parsedEx.range;
    const content = makePointsCommentContent(undefined, ex.atomicPoints, '', config);
    const newTxt = makeComment(content, config);
    edit.insert(parsedEx.document.uri, rng.end, `\n${newTxt}\n`, {
        needsConfirmation: needsConfirmation,
        label: 'Add Points Comments'
    });
}

export function makeComment(content: string, config?: vscode.WorkspaceConfiguration){
    config ||= getConfig();
    const template = config.get('comment.template', '???');
    return template.replace('%content%', content);
}

export function makePointsCommentContent(
    points: number | undefined,
    total: number,
    remark: string,
    config?: vscode.WorkspaceConfiguration,
    isSnippet?: boolean,
): string {
    config ||= getConfig();
    let template: string;
    if(remark || isSnippet){
        template = config.get('comment.pointsTemplateWithRemark', '???');
    } else {
        template = config.get('comment.pointsTemplate', '???');
    }
    let pointsString: string;
    if(points === undefined){
        pointsString = config.get('comment.pointsPlaceHolder', '???');
    } else{
        if(points < 0){
            points = total - points;
        }
        if(points < 0){
            points = 0;
        } else if(points > total){
            points = total;
        }
        pointsString = pointsToString(points);
    }
    const remarkString = isSnippet ? `\${1:${remark}}` : remark;
    const txt = (
        template
        .replace('%points%', pointsString)
        .replace('%total%', pointsToString(total))
        .replace('%remark%', remarkString)
    );
    return txt;
}

export async function changePoints(
    newScore: number | undefined,
    isDiff: boolean,
    mDoc: MatchedDocument,
    mex: MatchedExercise,
    pex?: ParsedExercise,
    pcomm?: PointComment,
    isSnippet?: boolean,
): Promise<PointComment | undefined> {
    pcomm = identifyPointsComment(mex, pex, pcomm);
    if(!pcomm){
        return undefined;
    }
    if(isDiff){
        newScore = pcomm.pointsScore + (newScore || 0);
        if(newScore < 0){
            newScore = 0;
        }
    }
    const editor = getVisibleEditors(mDoc.document)[0];
    isSnippet &&= !!editor;
    const newTxt = makePointsCommentContent(newScore, mex.atomicPoints, pcomm.remark.text, undefined, isSnippet);
    if(editor && isSnippet){
        const snippet = new vscode.SnippetString(newTxt);
        await editor.insertSnippet(snippet, pcomm.content.range);
    } else {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(mDoc.document.uri, pcomm.content.range, newTxt, {
            needsConfirmation: false,
            label: 'Change Points'
        });
        await vscode.workspace.applyEdit(edit);
        getDocTracker().handleChangeTextDocument();
    }
    // The range of this comment might have changed, so we will need to re-parse it!
    return pcomm;
}

export function identifyPointsComment(
    mex: MatchedExercise,
    pex?: ParsedExercise,
    pcomm?: PointComment,
): PointComment | undefined {
    if(pcomm){
        return pcomm;
    }
    if(!pex){
        return mex.pointsComments[0];
    }
    for(const pc of mex.pointsComments){
        if(pex.range.contains(pc.range)){
            return pc;
        }
    }
    return undefined;
}
