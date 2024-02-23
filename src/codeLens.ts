
import * as vscode from 'vscode';
import { getConfig, makeFlatExercises } from './readConfig';
import { getDocTracker } from './docTracker';
import { MatchedDocument, MatchedExercise, PointComment } from './types';
import { changePoints } from './modifyDocs';
import { pointsToString } from './webview';

export const CODE_LENS_COMMAND = 'vscode-grading.codeLens.changePoints';

let codeLensDispo: vscode.Disposable | undefined = undefined;

export function registerCodeLens(): vscode.Disposable {

    toggleCodeLens();
    
    vscode.commands.registerCommand(CODE_LENS_COMMAND, handleCodeLensCommand);

    return vscode.workspace.onDidChangeConfiguration(e => {
        if(e.affectsConfiguration('grading')){
            toggleCodeLens();
        }
    });
}

function toggleCodeLens(): void {
    const config = getConfig();
    const showCodeLenses = config.get<boolean>('codeLens.showCodeLenses', true);
    if(showCodeLenses === !!codeLensDispo){
        // Nothing to do...
        return;
    }
    // Dispose current provider anyways
    codeLensDispo?.dispose();
    codeLensDispo = undefined;
    // Return if we don't want to show the CodeLenses
    if(!showCodeLenses){
        return;
    }
    // Register new provider
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if(!workspaceFolder){
        console.log('Cannot register CodeLens: No workspace folder!');
        return undefined;
    }
    const pattern = new vscode.RelativePattern(
        workspaceFolder,
        config.get('examFiles.globPattern', '???')
    );
    const filter: vscode.DocumentFilter = {
        language: '*',
        pattern: pattern
    };
    codeLensDispo = vscode.languages.registerCodeLensProvider(
        filter,
        new CodeLensProvider()
    );
}

function handleCodeLensCommand(mdoc: MatchedDocument, ex: MatchedExercise, pcomm: PointComment, newScore?: number): void {
    changePoints(newScore, false, mdoc, ex, undefined, pcomm);
}

class CodeLensProvider implements vscode.CodeLensProvider {
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {

        console.log('CodeLensProvider.provideCodeLenses');
        const docTracker = getDocTracker();
        const mdoc = docTracker.handleDoc(document)?.matchedDoc;
        if(!mdoc){
            return [];
        }
        const config = getConfig();
        const steps = config.get<number>('codeLens.pointSteps', 1);
        const codeLenses: vscode.CodeLens[] = [];
        const flatExercises = makeFlatExercises(mdoc.exercises);
        for(const ex of flatExercises){
            for(const pc of ex.pointsComments){
                // Generate list of points to show
                const pointsList: (number | undefined)[] = [undefined];
                for(let points = 0; points <= ex.atomicPoints; points += steps){
                    pointsList.push(points);
                }
                if(pointsList[pointsList.length - 1] !== ex.atomicPoints){
                    pointsList.push(ex.atomicPoints);
                }
                
                // Get the range of the CodeLens
                // const rng = pc.range;
                let lineNum = pc.range.start.line;
                if(lineNum < document.lineCount - 1){
                    lineNum += 1;
                }
                const rng = mdoc.document.lineAt(lineNum).range;
                
                // Actually generate the CodeLenses
                for(const points of pointsList){
                    let txt = pointsToString(points);
                    if(
                        (pc.isPlaceHolder && points === undefined) ||
                        (!pc.isPlaceHolder && points === ex.achievedAtomicPoints)
                    ){
                        txt = `*${txt}*`;
                    }
                    codeLenses.push(new vscode.CodeLens(rng, {
                        title: txt,
                        command: CODE_LENS_COMMAND,
                        arguments: [
                            mdoc,
                            ex,
                            pc,
                            points
                        ],
                    }));
                }
            }
        }
        return codeLenses;
    }
}

