# 15. Test Cases

## Functional Tests

### Parse GitLab Discussion

Given MR page
When extension loads
Then discussions extracted

### Build Review Task

Given parsed discussion
When builder executes
Then ReviewTask created

### Dispatch Task

Given user clicks dispatch
When payload copied
Then task state updated

### Dispatch All Tasks

Given several open tasks
When user clicks "Send all"
Then one payload copied and every open task updated

Given the clipboard write fails
When user clicks "Send all"
Then every task in the batch is marked FAILED (no partial success)

### Resolve Discussion

Given discussion resolved
When extension syncs
Then task marked resolved

## Edge Cases

- deleted comments
- missing diff context (no `## Diff hunk` section is emitted)
- large discussion trimming
- "Send all" with nothing open / with a single open task (no batch header)
