#!/bin/sh
#    Setup PiTV
#
#    Copyright (C) 2014 Phil Plückthun <phil@plckthn.me>
#
#    This work is licensed under the MIT License

if [ `id -u` -ne 0 ]
then
  echo "Please start this script with root privileges!"
  echo "Try again with sudo."
  exit 0
fi

cat /etc/debian_version | grep 7. > /dev/null
if [ "$?" = "1" ]
then
  echo "This script was designed to run on Rasbian or a similar Debian 7.x distro!"
  echo "Do you wish to continue anyway?"
  while true; do
    read -p "" yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) exit 0;;
        * ) echo "Please answer with Yes or No [y|n].";;
    esac
  done
  echo ""
fi

echo "This script will install PiTV"
echo "Do you wish to continue?"

while true; do
  read -p "" yn
  case $yn in
      [Yy]* ) break;;
      [Nn]* ) exit 0;;
      * ) echo "Please answer with Yes or No [y|n].";;
  esac
done

echo ""
echo "============================================================"
echo "WARNING!"
echo "The next steps will overclock your RaspberryPi to Turbo Mode!"
echo "The Pi will need at least a 1 Amp connection!"
echo "Continue only if you know what you're doing!"
echo "============================================================"
echo ""

echo "Do you wish to continue?"

CURRENTUSER=`logname`

while true; do
  read -p "" yn
  case $yn in
      [Yy]* ) break;;
      [Nn]* ) exit 0;;
      * ) echo "Please answer with Yes or No [y|n].";;
  esac
done

echo ""
echo "============================================================"
echo ""
echo "Installing necessary dependencies... (This could take a while)"
echo ""

echo "============================================================"
apt-get update

if [ "$?" = "1" ]
then
  echo "An unexpected error occured!"
  exit 0
fi

apt-get upgrade -y

if [ "$?" = "1" ]
then
  echo "An unexpected error occured!"
  exit 0
fi

apt-get install matchbox chromium x11-xserver-utils ttf-mscorefonts-installer xwit sqlite3 libnss3 libavahi-compat-libdnssd-dev libc6 make gcc wget omxplayer git -y
echo "============================================================"

if [ "$?" = "1" ]
then
  echo "An unexpected error occured!"
  exit 0
fi

echo ""
echo "Downloading node.js..."

wget -q http://node-arm.herokuapp.com/node_latest_armhf.deb > /dev/null

if [ "$?" = "1" ]
then
  echo "An unexpected error occured while downloading!"
  exit 0
fi

echo ""
echo "Installing node.js..."

sudo dpkg -i node_latest_armhf.deb > /dev/null

if [ "$?" = "1" ]
then
  echo "An unexpected error occured!"
  exit 0
fi

rm node_latest_armhf.deb > /dev/null

echo ""
echo "Installing the forever CLI tool..."

echo "============================================================"
npm install -g forever
echo "============================================================"

if [ "$?" = "1" ]
then
  echo "An unexpected error occured!"
  exit 0
fi

echo ""
echo "Extracting PiTV application data..."

rm -rf /home/$CURRENTUSER/pitv > /dev/null
mkdir /home/$CURRENTUSER/pitv > /dev/null
tar -zxvf pitv-0.0.1-prealpha-data.tar.gz -C /home/$CURRENTUSER/pitv > /dev/null

echo ""
echo "Installing PiTV's dependencies... (This could take a while)"

echo "============================================================"
cd /home/$CURRENTUSER/pitv
npm install
echo "============================================================"

if [ "$?" = "1" ]
then
  echo "An unexpected error occured while downloading!"
  exit 0
fi

echo ""
echo "Updating Omxcontrol node module..."
cd /home/$CURRENTUSER/pitv/node_modules
rm -rf omxcontrol > /dev/null
git clone https://github.com/dplesca/omxcontrol.git > /dev/null

if [ "$?" = "1" ]
then
  echo "An unexpected error occured while updating!"
  exit 0
fi

echo ""
echo "Preparing configuration files..."

cat > /boot/config.txt  <<EOF
disable_overscan=1
framebuffer_width=1920
framebuffer_height=1080
framebuffer_depth=32
framebuffer_ignore_alpha=1
arm_freq=1000
hdmi_pixel_encoding=1
hdmi_group=2
gpu_mem=64
core_freq=500
sdram_freq=600
over_voltage=6
EOF

cat > /boot/xinitrc  <<EOF
#!/bin/sh
while true; do
	killall -9 chromium 2>/dev/null;
	killall -9 matchbox-window-manager 2>/dev/null;
	rm -rf /home/$CURRENTUSER/.cache;
	rm -rf /home/$CURRENTUSER/.config;
	rm -rf /home/$CURRENTUSER/.pki;
	mkdir -p /home/$CURRENTUSER/.config/chromium/Default
	sqlite3 /home/$CURRENTUSER/.config/chromium/Default/Web\ Data "CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR); INSERT INTO meta VALUES('version','46'); CREATE TABLE keywords (foo INTEGER);";
	xset -dpms
	xset s off
	fbset -depth \$( cat /sys/module/*fb*/parameters/fbdepth );
	xwit -root -warp \$( cat /sys/module/*fb*/parameters/fbwidth ) $( cat /sys/module/*fb*/parameters/fbheight )
	matchbox-window-manager -use_titlebar no -use_cursor no &
	chromium --disable-translate  --disable-3d-apis --disable-breakpad --disable-cast --disable-component-cloud-policy --disable-d3d11 --disable-extensions --disable-java --disable-login-animations --disable-plugins --disable-webgl --disable-infobars --kiosk --app=http://127.0.0.1/tv
done;
EOF

/bin/cp -f /etc/rc.local /etc/rc.local.old
cat > /etc/rc.local  <<EOF
PATH="\$PATH:/usr/local/bin"

_IP=\$(hostname -I) || true
if [ "\$_IP" ]; then
  printf "[PiTV] IP address is %s\n" "\$_IP"
  sleep 2
fi

while ! \$( tvservice --dumpedid /tmp/edid | fgrep -qv 'Nothing written!' ); do
	bHadToWaitForScreen=true;
	printf "[PiTV] Screen is not connected, off or in an unknown mode, waiting for it to become available...\n"
	sleep 10;
done;

printf "[PiTV] Screen is on, extracting preferred mode...\n"
_DEPTH=32;
eval \$( edidparser /tmp/edid | fgrep 'preferred mode' | tail -1 | sed -Ene 's/^.+(DMT|CEA) \(([0-9]+)\) ([0-9]+)x([0-9]+)[pi]? @.+/_GROUP=\1;_MODE=\2;_XRES=\3;_YRES=\4;/p' );

printf "[PiTV] Resetting screen to preferred mode: %s-%d (%dx%dx%d)...\n" \$_GROUP \$_MODE \$_XRES \$_YRES \$_DEPTH
tvservice --explicit="\$_GROUP \$_MODE"
sleep 1;

printf "[PiTV] Resetting frame-buffer to %dx%dx%d...\n" \$_XRES \$_YRES \$_DEPTH
fbset --all --geometry \$_XRES \$_YRES \$_XRES \$_YRES \$_DEPTH -left 0 -right 0 -upper 0 -lower 0;
sleep 1;

printf "[PiTV] Starting TV Server"
forever start --watch --silent --sourceDir /home/$CURRENTUSER/pitv main.js

printf "[PiTV] Waiting 30 seconds so the server is ready"
sleep 30;
if [ -f /boot/xinitrc ]; then
	ln -fs /boot/xinitrc /home/$CURRENTUSER/.xinitrc;
	su - $CURRENTUSER -c 'startx' &
fi
exit 0
EOF

echo "============================================================"
echo "Setup was successful!"
echo "Do not delete the 'pitv' folder as it contains all application data!"
echo "REBOOTING..."
echo "============================================================"

sleep 5
reboot
exit 0
