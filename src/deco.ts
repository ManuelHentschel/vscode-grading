
import * as types from './types';
import * as vscode from 'vscode';
import { getConfig, makeFlatExercises } from './readConfig';
import { adjustRange, getCoveredRange } from './utils';
import { getFirstLineRange } from './utils';
import { getLastLineRange } from './utils';
import { exIsGraded } from './webviewTables';
import { pointsToString } from './webview';
import { RangeOption } from './utils';


export interface DecoWithRanges {
    deco: vscode.TextEditorDecorationType
    ranges: vscode.Range[];
}

export interface BackgroundDecos {
    exercise: DecoRange;
    exerciseZeroPoints: DecoRange;
    exercisePartialPoints: DecoRange;
    exerciseFullPoints: DecoRange;
    exerciseFirstLine: DecoRange;
    comment: DecoRange;
    pointsComment: DecoRange;
    unmatched: DecoRange;
}

class DecoRange {
    constructor(
        public decoOptions: vscode.DecorationRenderOptions = {},
        public rangeOption: RangeOption = "asIs",
        public ranges: vscode.Range[] = [],
    ) {}
    
    public getDecoWithRanges(doc: vscode.TextDocument): DecoWithRanges {
        let ranges = this.ranges.map(range => adjustRange(doc, range, this.rangeOption));
        return {
            deco: vscode.window.createTextEditorDecorationType(this.decoOptions),
            ranges: ranges
        };
    }    

    public apply(editor: vscode.TextEditor): void {
        if(this.ranges.length === 0){
            return;
        }
        let ranges = this.ranges.map(range => adjustRange(editor.document, range, this.rangeOption));
        editor.setDecorations(
            vscode.window.createTextEditorDecorationType(this.decoOptions),
            ranges
        );
    }
    
    public clone(decoOptions: vscode.DecorationRenderOptions = {}, includeRanges: boolean = false): DecoRange {
        const newDecoOptions = {
            ...this.decoOptions,
            ...decoOptions
        };
        const ranges: vscode.Range[] = [];
        if(includeRanges){
            ranges.push(...this.ranges);
        }
        return new DecoRange(newDecoOptions, this.rangeOption, ranges);
    }
}

function rgba(r: number, g: number, b: number, a: number): string {
    return `rgba(${r},${g},${b},${a})`;
}

function getBackgroundDecos(): BackgroundDecos {
    const config = getConfig();
    const decoExerciseBackground = config.get<boolean>('deco.exerciseBackground', true);
    function makeExDeco(red: number, green: number, blue: number): DecoRange {
        if(decoExerciseBackground){
            return new DecoRange({
                backgroundColor: rgba(red, green, blue, 0.1),
                overviewRulerColor: rgba(red, green, blue, 0.2),
                isWholeLine: true
            }, 'withoutTrailing');
        }
        return new DecoRange();
    }
    return {
        exercise: makeExDeco(128, 128, 256),
        exerciseFullPoints: makeExDeco(0, 255, 0),
        exercisePartialPoints: makeExDeco(255, 255, 0),
        exerciseZeroPoints: makeExDeco(255, 64, 0),
        exerciseFirstLine: new DecoRange({
            backgroundColor: rgba(255, 255, 255, 0.1),
            fontWeight: 'bold',
            isWholeLine: true
        }, 'firstLine'),
        pointsComment: new DecoRange({
            fontWeight: 'bold',
            textDecoration: 'underline'
        }),
        comment: new DecoRange({
            fontStyle: 'italic',
        }),
        unmatched: new DecoRange({
            backgroundColor: rgba(255, 0, 0, 0.3),
            overviewRulerColor: rgba(255, 0, 0, 0.3),
            fontWeight: 'bold',
            isWholeLine: true
        }, 'withoutTrailing')
    };
}

export class DecoManager {
    constructor() {}
    

    public clearDecos(decos: DecoWithRanges[]){
        for(const dwr of decos){
            dwr.deco.dispose();
        }
    }
    
    public applyDecos(editor: vscode.TextEditor, decos: DecoWithRanges[]){
        for(const dwr of decos){
            editor.setDecorations(
                dwr.deco,
                dwr.ranges
            );
        }
    }
    
    public computeDecos(mdoc: types.MatchedDocument): DecoWithRanges[]{
        const config = getConfig();
        const debugDecos = config.get<boolean>('deco.showDebugInfo', false);

        const doc = mdoc.document;
        const flatExs = makeFlatExercises(mdoc.exercises);
        const normalComments: types.ParsedComment[] = mdoc.unmatchedComments;
        const pointsComments: types.PointComment[] = [];
        const ret: DecoWithRanges[] = [];
        
        const bgd = getBackgroundDecos();
        
        // Handle matched exercises
        for(const ex of flatExs){
            bgd.comment.ranges.push(...ex.parsedComments.map(pc => pc.range));
            normalComments.push(...ex.parsedComments);
            const achievedPointsString = pointsToString(ex.achievedTotalPoints);
            const possiblePointsString = pointsToString(ex.totalPoints);
            const decoText = `[${ex.id}: ${achievedPointsString} / ${possiblePointsString }]`;
            pointsComments.push(...ex.pointsComments);

            for(const pex of ex.parsedExercises){
                const exRange = pex.range;
                const firstLineRange = getFirstLineRange(doc, exRange);
                const decoRange =  exRange;
                if(!exIsGraded(ex)){
                    bgd.exercise.ranges.push(decoRange);
                } else if(ex.achievedTotalPoints === 0){
                    bgd.exerciseZeroPoints.ranges.push(decoRange);
                } else if(ex.achievedTotalPoints < ex.totalPoints){
                    bgd.exercisePartialPoints.ranges.push(decoRange);
                } else {
                    bgd.exerciseFullPoints.ranges.push(decoRange);
                }
                bgd.exerciseFirstLine.ranges.push(decoRange);
                ret.push(
                    this.makeAfterTextDeco(decoText, [firstLineRange])
                );
                if(debugDecos){
                    ret.push(
                        this.makeAfterTextDeco('/' + ex.id, [getLastLineRange(doc, exRange, true)])
                    );
                }
            }
        }
        
        // Handle unmatched exercises
        for(const ex of mdoc.unmatchedExercises){
            const decoRange = doc.lineAt(ex.range.start.line).range;
            const textDeco = this.makeAfterTextDeco(`${ex.isDuplicate ? 'DUPLICATE EXERCISE' : 'UNKNOWN EXERCISE'}: ` + ex.name, [decoRange]);
            ret.push(textDeco);
            bgd.unmatched.ranges.push(ex.range);
            bgd.exerciseFirstLine.ranges.push(ex.range);
        }
        
        // Handle normal comments
        if(debugDecos){
            for(const comm of normalComments){
                ret.push(
                    this.makeAfterTextDeco(`COMMENT: ${comm.content.text}`, [getFirstLineRange(doc, comm.range)])
                );
            }
        }
        
        // Handle points comments
        for(const pcomm of pointsComments){
            const txt = `POINTS: ${pcomm.pointsScore} (${pcomm.remark.text})`;
            if(debugDecos){
                ret.push(
                    this.makeAfterTextDeco(txt, [getFirstLineRange(doc, pcomm.range)])
                );
            }
            bgd.pointsComment.ranges.push(pcomm.pointsText.range);
            bgd.comment.ranges.push(pcomm.range);
        }
        
        for(const pcomm of mdoc.unmatchedPointsComments){
            const txt = `${pcomm.isDuplicate ? 'DUPLICATE' : 'UNMATCHED'} POINTS COMMENT: ${pcomm.pointsScore} (${pcomm.remark.text})`;
            ret.push(
                this.makeAfterTextDeco(txt, [getFirstLineRange(doc, pcomm.range)])
            );
            bgd.unmatched.ranges.push(pcomm.range);
        }
        
        for(const [k, v] of Object.entries(bgd)){
            ret.push(v.getDecoWithRanges(mdoc.document));
        }

        return ret;
    }
    
    private makeAfterTextDeco(text: string, ranges: vscode.Range[]): DecoWithRanges {
        const deco = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ' ' + text
            }
        });
        const decoWithRanges = {
            deco: deco,
            ranges: ranges
        };
        return decoWithRanges;
    }
}


