# Test cases for the workshop - by waves

A set for the Tesena Fest 2026 workshop, Todoist API.

## Wave 1 - smoke

- TC-001 [Projects] A new project is created and comes back under the name that was entered
- TC-002 [Tasks] A new task is created with the text that was entered
- TC-003 [Tasks] A new task is created with the due date that was entered
- TC-004 [Labels] A new label is created under the name that was entered
- TC-005 [Comments] A comment is added to a task with the text that was entered

## Wave 2 - functional tests of a single feature

- TC-006 [Projects] A renamed project loads under the new name the next time it is opened, not only in the response to the update
- TC-007 [Tasks] A task can be created with the required fields only, and every optional field is stored exactly as it was entered
- TC-008 [Tasks] A project's task list contains only the tasks of that project, nothing from elsewhere
- TC-009 [Tasks] A due date entered in words lands on the same day as the same date entered explicitly

## Wave 3 - end-to-end scenarios

- TC-010 [E2E] A user creates a project, splits it into sections, adds a task with a due date to one of them, and finally ticks it off
- TC-011 [E2E] A project from empty to done: three tasks, two ticked off, one still open at the end

## Wave 4 - alternative scenarios

- TC-012 [Tasks] A task ticked off by mistake can be put back among the open ones, and it is the same task, not a new one
- TC-013 [Tasks] A recurring task does not disappear when ticked off and moves on to its next due date

## Wave 5 - critical negative scenarios

- TC-014 [E2E] With no access token and with a malformed token the request fails with 401 and nothing is created
- TC-015 [Tasks] A task with no text, with a required field missing, and with an unreadable due date is rejected
