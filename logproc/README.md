# Archive Log Processing

## Install / set up

you will need at least node/npm.

```
cd logproc
npm install --no-bin-links
```

## Process Logs offline

e.g.
```
node lib/processlogs.js ../test/data/example_entity_list.json \
  ../test/data/20170608T112725862Z-default.log '../test/data/Climb!June8.csv' \
  ../test/data/recordingsJune8.yml ../test/data/narrativesJune8.csv
```

Copy processed logs over to archive app...
```
cp ../test/data/recordingsJune8.yml-annalist.json ../archive-app/src/assets/data/climb-recordings-20170608.json
cp ../test/data/Climb\!June8.csv-annalist.json ../archive-app/src/assets/data/climb-stages-20170608.json
cp ../test/data/20170608T112725862Z-default.log-annalist.json ../archive-app/src/assets/data/climb-performances-20170608.json
cp ../test/data/example_entity_list.json ../archive-app/src/assets/data/records.json
cp ../test/data/Climb\!June8.csv ../archive-app/src/assets/data/
cp ../test/data/narrativesJune8.csv ../archive-app/src/assets/data/
cp ../test/data/empty_entity_list.json ../archive-app/src/assets/data/performance-e888ea0f-8c81-48a8-8462-bc98dd04f495-annalist.json
cp ../test/data/empty_entity_list.json ../archive-app/src/assets/data/performance-f01a5d26-6569-4879-9aef-58334110c307-annalist.json
```
Note, app data files to load in ../archive-app/src/assets/data/. See especially
urls.json (list of files to read).

At some point this should be wrapped up in an on-demand server.

## Midi files

MIDI files of notes
```
node lib/log2midi.js test/data/20170608T112725862Z-default.log
```

## Online

Configure log processing server (just processes musicodes logs to performances).
See `etc/config.yml`

Run server
```
node lib/server.js [CONFIGFILE]
```

By default runs on port 4202 (see config) and accepts musicodes log file POST to `/api/1/processlog`.

Outputs a file like `performance-PERFID-annalist.json` to the specified output directory.

Note, will only output files for performances found in the annalist entries loaded at start-up time.

## Online / Docker

```
sudo docker build -t logproc .
```

Will expose port 8000 by default. Volume /srv/archive/outputs should mount the archive-app assets/data directory.

```
sudo docker run --name logproc -p 4201:8000 -d \
  -v `pwd`/../archive-app/src/assets/data:/srv/archive/output logproc
```
