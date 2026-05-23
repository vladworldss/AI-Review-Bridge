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

### Resolve Discussion

Given discussion resolved
When extension syncs
Then task marked resolved

## Edge Cases

- deleted comments
- missing diff context
- large discussion trimming
