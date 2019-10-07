export default (d: any) =>
`[Unit]
Description=${d.name}
After=network.target

[Service]
Type=simple
StandardOutput=${d.stdOut}
StandardError=${d.stdErr}
ExecStart=${d.exec} ${d.deepstreamArgs}
Restart=always
User=${d.user}
Group=${d.group}
Environment=

[Install]
WantedBy=multi-user.target

`
