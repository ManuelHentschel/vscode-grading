import * as vscode from "vscode";
import { getConfig, getConfigExercises, getFlatConfigExercises, makeFlatExercises } from './readConfig';
import { Exercise, MatchedDocument, MatchedExercise } from './types';
import { verifyUri, getDocTracker, SOLUTION_ID  } from './docTracker';
import { arraySum, deepCopy, isDefined, isMDoc } from "./utils";



export async function findUris(includeSolution: boolean = false, onlySolution: boolean = false): Promise<vscode.Uri[]> {
    const config = getConfig();
    const fileGlob = config.get<string>('examFiles.globPattern', '**/*');
    let uris = await vscode.workspace.findFiles(fileGlob);
    uris = uris.filter(uri => {
        const id = verifyUri(uri);
        if(!id){
            return false;
        }
        if(onlySolution){
            return id === SOLUTION_ID;
        }
        if(!includeSolution){
            return id !== SOLUTION_ID;
        }
        return true;
    });
    uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    return uris;
}

export async function parseAllFiles(includeSolution: boolean = false): Promise<Map<string, MatchedDocument[]>> {
    const docTracker = getDocTracker();
    const uris = await findUris(includeSolution);
    const docPromises = uris.map(vscode.workspace.openTextDocument);
    const docs = await Promise.all(docPromises);
    const ret = new Map<string, MatchedDocument[]>();
    for(const doc of docs){
        const td = docTracker.handleDoc(doc);
        if(!td){
            continue;
        }
        const id = td.matchedDoc.id;
        const mDocs = ret.get(id) || [];
        mDocs.push(td.matchedDoc);
        ret.set(id, mDocs);
    }
    return ret;
}

export async function getSolutionExercises(): Promise<MatchedExercise[]> {
    const mDocs = await getSolutionMDocs();
    const exs = mDocsToExercises(mDocs);
    return exs;
}

export async function getSolutionMDocs(): Promise<MatchedDocument[]> {
    const uris = await findUris(true, true);
    const docPromises = uris.map(vscode.workspace.openTextDocument);
    const docs = await Promise.all(docPromises);
    const docTracker = getDocTracker();
    const maybeMDocs = docs.map(doc => docTracker.handleDoc(doc)?.matchedDoc);
    const mDocs = maybeMDocs.filter<MatchedDocument>(isDefined);
    return mDocs;
}

export async function parseAllFilesToJsonFile(): Promise<void> {
    const json = await getAllFilesJson();
    const jsonDoc = await vscode.workspace.openTextDocument({language: 'json', content: json});
    await vscode.window.showTextDocument(jsonDoc);
}

export async function parseAllFilesToCsvFile(): Promise<void> {
    const csv = await getAllFilesCsv();
    const csvDoc = await vscode.workspace.openTextDocument({language: 'csv', content: csv});
    await vscode.window.showTextDocument(csvDoc);
}

async function getAllFilesCsv(): Promise<string> {
    const allFiles = await parseAllFiles();
    // const files
    const nestedExam = getConfigExercises();
    const exam = makeFlatExercises(nestedExam);
    const colnames = exam.map(ex => ex.name);
    const entries: string[][] = [];

    for (const [id, mdocs] of allFiles) {
        const nestedExs = mDocsToExercises(mdocs);
        if(!compareExNames(nestedExam, nestedExs)){
            // This check should not be necessary, but good for debugging
            console.error('Exercise names do not match for id:', id);
            continue;
        }
        const total = arraySum(nestedExs.map(ex => ex.achievedTotalPoints));
        const flatExs = makeFlatExercises(nestedExs);
        const points = flatExs.map(ex => String(ex.achievedTotalPoints));
        entries.push([id, ...points, String(total)]);
    }
    const rows = entries.map(points => points.join(','));
    rows.unshift(['id', ...colnames, 'Total'].join(','));
    const ret = rows.join('\n');
    return ret;
}

function compareExNames(a0: Exercise[], a1: Exercise[]): boolean {
    if(a0.length !== a1.length){
        return false;
    }
    for (let i = 0; i < a0.length; i++) {
        const ex0 = a0[i];
        const ex1 = a1[i];
        if(!ex0 || !ex1){
            continue; // This should not happen because of length check!
        }
        if(ex0.name !== ex1.name){
            return false;
        }
        if(!compareExNames(ex0.subExercises, ex1.subExercises)){
            return false;
        }
    }
    return true;
}

async function getAllFilesJson(): Promise<string> {
    const allFiles = await parseAllFiles();
    const filesObj = filesToObject(allFiles);
    const ret = JSON.stringify(filesObj, undefined, 4);
    return ret;
}

export function mDocsToExercises(mDocs: MatchedDocument[]): MatchedExercise[] {
    const allExercises = mDocs.reduce<MatchedExercise[]>(
        (pEx, mDoc) => [...pEx, ...mDoc.exercises],
        []
    );
    const joinedExercises = joinMatchedExercises(allExercises);
    return joinedExercises;
}

function joinMatchedExercises(exs: MatchedExercise[]): MatchedExercise[]{
    const ret: MatchedExercise[] = [];
    for(const ex of exs){
        let found = false;
        for(const ex0 of ret){
            if(ex.name === ex0.name){
                ex0.subExercises.push(...ex.subExercises);
                ex0.achievedAtomicPoints += ex.achievedAtomicPoints,
                ex0.achievedTotalPoints += ex.achievedTotalPoints,
                ex0.parsedExercises.push(...ex.parsedExercises);
                ex0.parsedComments.push(...ex.parsedComments);
                ex0.pointsComments.push(...ex.pointsComments);
                found = true;
                break;
            }
        }
        if(!found){
            // If not found: add a COPY (!) to ret
            const tmp = deepCopy(ex);
            ret.push(tmp);
        }
    }
    // Recurse
    for(const ex of ret){
        ex.subExercises = joinMatchedExercises(ex.subExercises);
    }
    return(ret);
}



interface FilesOut {
    [key: string]: MatchedDocumentOut[]
}
interface MatchedDocumentOut {
    filename: string,
    id: string,
    exercises: ExerciseOut[]
}
interface ExerciseOut extends Pick<
    MatchedExercise,
    'name' | 'atomicPoints' | 'achievedAtomicPoints' | 'totalPoints' | 'achievedTotalPoints'
>{
    subExercises?: ExerciseOut[]
}
function filesToObject(files: Map<string, MatchedDocument[]>){
    const ret: FilesOut = {};
    files.forEach((v, k) => {
        ret[k] = v.map(mDocToObject);
    });
    return ret;
}
function mDocToObject(mdoc: MatchedDocument): MatchedDocumentOut {
    const exs = mdoc.exercises.map(ex => exerciseToObject(ex, true));
    return {
        filename: mdoc.document.fileName,
        id: mdoc.id,
        exercises: exs
    };
}
function exerciseToObject(ex: MatchedExercise, nested = true): ExerciseOut{
    const exOut: ExerciseOut = {
        name: ex.name,
        atomicPoints: ex.atomicPoints,
        achievedAtomicPoints: ex.achievedAtomicPoints,
        totalPoints: ex.totalPoints,
        achievedTotalPoints: ex.achievedTotalPoints,
    };
    if(nested){
        exOut.subExercises = ex.subExercises.map(subEx => exerciseToObject(subEx, nested));
    }
    return exOut;
}



