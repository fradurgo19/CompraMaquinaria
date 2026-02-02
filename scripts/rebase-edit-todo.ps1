# Git passes the todo file path as first argument
$todoPath = $args[0]
(Get-Content $todoPath -Raw) -replace '^pick ', 'edit ' | Set-Content $todoPath -NoNewline
