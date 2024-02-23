
# Example Project

This folder contains an example "exam".
The questions are in `questions.md`, but this file is not considered by the extension.
The structure of the exam is configured in the workspace settings (`.vscode/settings.json`).
The submitted exams are in `exams/`, partially graded.
The solutions are in `solutionsEx1.R`/`solutionsEx2.R`.

**To view status:**

- Check which exercises are recognized using command `vscode-grading.checkPresent`
- Check which exercises are already graded using command `vscode-grading.checkGraded`
- See points using `vscode-grading.checkPoints`

In each of these webviews, the (present) exercises can be ctrl+clicked to go to the corresponding file.


**To grade:**

- Add/modify points comments directly in the editor
- Click on the code-lenses to assign points
- Use keyboard-shortcuts to assign points (e.g. `ctrl+k 2` for 2 points, `ctrl+k -` to decrement points)

**Other commands:**

- Call command `vscode-grading.addPointsComments` to add placeholders for points comments.
- Call command `vscode-grading.normalizePointsComments` to remove empty comments etc.
- Call command `vscode-grading.showSolution` to show the solution of individual questions.
- Call command `vscode-grading.showExercise` to show the submissions for an individual question (*WIP*).

(**To change the comment patterns:** See description of config entries.)
