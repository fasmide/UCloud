if [ ! -f "/etc/ucloud/core.yaml" ]; then
  mkdir /etc/ucloud
  chmod 644 /etc/ucloud/*
  chown -R ucloud: /etc/ucloud/
  mkdir /var/log/ucloud
  chmod 700 /var/log/ucloud
  chown -R ucloud: /etc/ucloud/
  chown -R ucloud: /var/log/ucloud

  chown -R munge:munge /etc/munge
  service munge start 
  chown ucloud:ucloud ${DATA_MOUNT} 

  rm /etc/ucloud/config_installer.sh

  echo -e   '{ 
	"remoteHost": "localhost", 
	"remotePort": 8889, 
	"remoteScheme": "http", 
	"sharedSecret": "somesharedsecret" 
  } ' > /etc/ucloud/frontend_proxy.json

  chown ucloud:ucloud /etc/ucloud/frontend_proxy.json
  chmod 640 /etc/ucloud/frontend_proxy.json
  usermod -a -G ucloud testuser
  chmod 600 /etc/ucloud/frontend_proxy.json

fi

chmod +x /opt/ucloud/compose-init.sh
/opt/ucloud/compose-init.sh
service munge start 
