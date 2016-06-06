OS=$( node scripts/details.js OS )

if [ $OS = 'win32' ]; then

	if [ ! -d "nexe_node" ]; then
		curl -o nexe_node.7z https://s3.amazonaws.com/ds-server-artifacts/nexe_node_windows_ultra_4.4.5.7z
		7z x nexe_node.7z -y
	fi

fi
