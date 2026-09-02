$p = Start-Process -FilePath 'npx.cmd' -ArgumentList 'next','dev','-p','3002' -RedirectStandardOutput 'C:\Users\Windows 11\Desktop\Project 1\.freebuff\preview-96ce3428-7c7f-4065-810a-6a8b8a9a208b.log' -RedirectStandardError 'C:\Users\Windows 11\Desktop\Project 1\.freebuff\preview-96ce3428-7c7f-4065-810a-6a8b8a9a208b.log.err' -WindowStyle Hidden -PassThru
$p.Id
