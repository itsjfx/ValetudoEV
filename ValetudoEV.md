# Valetudo EV

Super experimental version of [Valetudo](https://github.com/Hypfer/Valetudo) to
add support Ecovacs.

You should definitely not use this. I may abandon this project at any time.

I'm doing this for fun, to learn how robot vacuums work, and to learn how
Valetudo works a bit better as a happy user on my already Valetudo supported
robot vacuum. This is not my job and I've also got other commitments.

This is sorta PoC'y to prove that you can do your own "cloud" for Ecovacs. The
code is not very good at the moment and it will continue sucking long term.

**Does this do X?** Probably not. Don't raise an issue asking me to implement
something. Did I mention you shouldn't use this?

This will probably only work on an Ecovacs X1 Omni as this is the **only**
"supported" hardware. Supported = maybe it won't crash.

If you're lucky it'll do what it says it will do in the "what does it do?"
section very badly.

I didn't want to write any of the above, but I've seen how people behave in
Telegram and want to try set the record straight.


## what does it do?

Not much at the moment:
* Can do WiFi provisioning (first time/reset WiFi setup)
* Send and receive messages from the bot
    * The only thing it can do is figure out if it's charging and what the
      battery percentage is... I think


## resources

See these resources (from [the Ecovacs_hacking
telegram](https://t.me/c/2055937713/2)):
* The Ecovacs hacking talk:
  https://dontvacuum.me/talks/37c3-2023/37c3-vacuuming-and-mowing.html
* Youtube video (watch and like): https://www.youtube.com/watch?v=56N1dYfdVf4
* Hardware information: https://robotinfo.dev
* Ecovacs root password calculator:
  https://builder.dontvacuum.me/ecopassword.php
* Talk slides with root instructions in last page:
  https://dontvacuum.me/talks/37c3-2023/37c3-vacuuming-and-mowing.pdf
* maybe also read through my notes in
  <https://github.com/itsjfx/ecovacs-hacking>


## installation / usage

1. Login to your Ecovacs robot as `root` via uart
    * Connect uart based on the pin out of the 37c3 talk slides (link above)
    * for the X1 Omni I had to flip the pin out 180 degrees
    * based on chatter in the Telegram this seems normal
    * I'd encourage metering all the pins and checking yourself
2. Install custom firmware on your robot... if you want SSH and be dangerous
    * you can build your own, following the rootfs flashing instructions from
      Telegram which works
    * or you can try my script from here:
      <https://github.com/itsjfx/ecovacs-hacking/blob/master/bin/patch-rootfs>
        * this installs
          [dropbear](https://matt.ucc.asn.au/dropbear/dropbear.html)
        * and can add an SSL certificate to `/etc/ssl/certs`, which doesn't seem
          to be needed anyway
    * this script depends on you having `GNU Bash`, `dropbear` (to generate host
    keys), and `squashfs-tools` installed, maybe other stuff
    * it's probably got **terrible** error handling, and it'll likely destroy
      your robot!
    * but it should help you get started
    * following `repack_rootfs.txt`:
        1. Rip your rootfs with `dd` e.g. `dd if=/dev/ubi0_0 of=/tmp/ubi0_0.img
           bs=1M`
        2. Get it off the robot using your favourite tool, e.g. `nc` or whatever
        3. Run `bash bin/patch-rootfs ubi0_0.img --dropbear
           ~/.ssh/id_ed25519.pub --add-cert ~/.mitmproxy/mitmproxy-ca-cert.cer`
        4. This will spit out a modified rootfs alongside your existing one
        5. Copy this to your robot using your preferred method and follow the
           rest of the steps to flash it
3. Generate SSL certificates for the MQTT server
    * I've not automated this
    * I think this is always going to be a thing so I may make this a better
      experience
    * I think I ran these commands, and dropped the files in `backend/lib/ecovacs`
```bash
openssl genpkey -algorithm RSA -out server.key
openssl req -new -key server.key -out server.csr
openssl req -x509 -key server.key -out server.crt -days 6969
```
4. Run Valetudo in one of two modes
   * Embedded
       1. Build `valetudo` via `npm run build_aarch64 --workspace=backend`
       2. Copy the built binary to your robot and run it
       3. I got this `autostart` script which lives in
          `/data/autostart/valetudo.sh`, which is enabled via my custom firmware
```bash
#!/bin/sh

export VALETUDO_CONFIG_PATH=/data/valetudo_config.json

load() { /data/valetudo & }
unload() { killall valetudo || true; }

case "$1" in
      start)
            load
             ;;
       stop)
            unload
             ;;
       restart)
            unload
            load
             ;;
        *)
             echo "$0 <start/stop/restart>"
             ;;
esac
```
   * On your machine
       * I override the DNS of the robot to point to my local machine via hosted
         DNS server
       * You can probably do it via `/tmp/root/etc/hosts` too, but this will not
         persist across reboots, unless you make a script to do this
       * Run Valetudo normally, e.g. `npm run start:dev --workspace=backend` and
         `npm run watch --workspace=frontend`
5. You probably need to set these config values so Valetudo can talk to it.
   Embedded or not embedded.
    * from
      <https://github.com/itsjfx/ecovacs-hacking/blob/master/x1_omni.md#secrets>
      or using `mdsctl bumbee '{"todo":"QueryIotInfo"}'`
```
{
  "embedded": false,
  "robot": {
    "implementation": "EcovacsX1OmniValetudoRobot",
    "implementationSpecificConfig": {
      "ip": "127.0.0.1",
      "deviceId": "x",
      "mId": "x",
      "resourceId": "x"
    }
  }
  ...
}
``` 


## contributing / how to do this yourself ?

I dunno, you probably want traffic inspection set up so you can capture the
IoT/MQTT traffic of the device, then write some code in Valetudo to basically do
the same thing

my notes on traffic inspection are here:
<https://github.com/itsjfx/ecovacs-hacking/blob/master/x1_omni.md#traffic-inspection>

other than what's already in the Ecovacs Telegram channel and Dennis' talk, I
figured out this out myself, don't bother people directly, I didn't do this and
don't encourage this

all my notes are in my [ecovacs-hacking
repo](https://github.com/itsjfx/ecovacs-hacking), and i try to write down mostly
everything, so therefore everything I know should be there =)

if anything I hope someone can look at this repo + ecovacs-hacking and
get something out of it.

happy hacking!
