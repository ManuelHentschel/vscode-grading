
import * as vscode from 'vscode';

// Satisfied e.g. by vscode.TextLine
export interface TextWithRange {
    text: string;
    range: vscode.Range;
}

export interface TextWithRangeAndDoc extends TextWithRange {
    document: vscode.TextDocument;
}

export interface ParsedComment extends TextWithRangeAndDoc {
    content: TextWithRange;
}

export interface ParsedExercise extends TextWithRangeAndDoc {
    name: string;
    nameRange: vscode.Range;
    isDuplicate?: boolean;
}

export interface PointComment extends ParsedComment{
    pointsOfTotal: TextWithRange;
    pointsText: TextWithRange;
    remark: TextWithRange;
    pointsScore: number;
    isPlaceHolder?: boolean;
    isFullPoints: boolean;
    isDuplicate?: boolean;
    isUnmatched?: boolean;
}

export interface ConfigExercise {
    name: string;
    atomicPoints?: number;
    subExercises?: ConfigExercises;
}

export type ConfigExercises = ConfigExercise[] | {
    [key: string]: (number | {
        atomicPoints?: number;
        subExercises?: ConfigExercises;
    })
};

export interface NestedExercise<T extends NestedExercise<T>> {
    subExercises: T[];
}

export interface NExercise<T extends NExercise<T>>{
    // The name of the exercise
    name: string;
    
    // Unique ID of the exercise
    id: string;

    // Exercises that are part of this one
    subExercises: T[];

    // Points for this exercise (excluding points from subExercises)
    atomicPoints: number;
    
    totalPoints: number;
}

export interface Exercise extends NExercise<Exercise> {};

export interface MatchedExercise extends NExercise<MatchedExercise> {
    subExercises: MatchedExercise[];
    
    achievedAtomicPoints: number;
    achievedTotalPoints: number;

    parsedExercises: ParsedExercise[];
    parsedComments: ParsedComment[];
    pointsComments: PointComment[];
}

export interface ParsedDocument {
    document: vscode.TextDocument;
    id: string;
    parsedExercises: ParsedExercise[];
    parsedComments: ParsedComment[];
}

export interface MatchedDocument {
    document: vscode.TextDocument;
    id: string; // student ID etc.
    exercises: MatchedExercise[]; // Must be same structure as exercises in config!
    unmatchedExercises: ParsedExercise[];
    unmatchedComments: ParsedComment[];
    unmatchedPointsComments: PointComment[];
}

