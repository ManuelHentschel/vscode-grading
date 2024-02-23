import { FDoc, TextFromDoc, TextFromText } from './fDocs';
import { mDocsToExercises, parseAllFiles } from './export';
import { makeFlatExercises } from './readConfig';
import { ParsedExercise } from './types';
import * as vscode from 'vscode';

export async function getFDocContentForExercise(id: string): Promise<string> {
    const fdoc = await getFDocForExercise(id);
    return fdoc.getText();
}

export async function getFDocForExercise(id: string): Promise<FDoc> {
    const tmp = await parseAllFiles();
    // iterate over elements of tmp:
    const pexs: ParsedExercise[] = [];
    for(const [studentId, mdocs] of tmp){
        const studentMexs = mDocsToExercises(mdocs);
        const flatMexs = makeFlatExercises(studentMexs);
        const mex = flatMexs.find(mex => mex.id === id);
        
        if(mex){
            pexs.push(...mex.parsedExercises);
        }
    }
    const fdoc = new FDoc();
    for(const pex of pexs){
        const relPath = vscode.workspace.asRelativePath(pex.document.uri);
        const label = new TextFromText(
            `# ${relPath}`
        );
        const txtSource = new TextFromDoc(
            pex.document,
            pex.range
        );
        fdoc.addPart(label);
        fdoc.addPart(txtSource);
    }
    return fdoc;
}
