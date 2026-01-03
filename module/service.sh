#!/bin/sh

MODDIR=${0%/*}
KPNDIR="/data/adb/kp-next"
PATH="$MODDIR/bin:$PATH"
CONFIG="$KPNDIR/package_config"
key="$(cat $KPNDIR/key | base64 -d)"

if [ -z "$key" ] || [ -z "$(kpatch $key hello)" ]; then
    touch "$MODDIR/unresolved"
    exit 0
fi

for kpm in $KPNDIR/kpm/*.kpm; do
    [ -s "$kpm" ] || continue
    kpatch "$key" kpm load "$kpm"
done

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 1
done

[ -f "$CONFIG" ] || exit 0

tail -n +2 "$CONFIG" | while IFS=, read -r pkg exclude allow uid; do
    if [ "$exclude" = "1" ]; then
        uid=$(grep "^$pkg " /data/system/packages.list | cut -d' ' -f2)
        [ -n "$uid" ] && kpatch "$key" exclude_set "$uid" 1
    fi
done
