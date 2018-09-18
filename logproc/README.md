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
  ../test/data/20170608T112725862Z-default.log '../test/data/Climb!London.csv' \
  ../test/data/recordingsJune8.yml ../test/data/narrativesLondon.csv \
  ../test/data/mkGameEngine.xlsx ../test/data/performances.json
```

Copy processed logs over to archive app...
```
cp ../test/data/recordingsJune8.yml-annalist.json \
 ../archive-app/src/assets/data/climb-recordings-20170608.json
cp ../test/data/Climb\!London.csv-annalist.json \
 ../archive-app/src/assets/data/climb-stages-20170825.json
cp ../test/data/20170608T112725862Z-default.log-annalist.json \
 ../archive-app/src/assets/data/climb-performances-20170608.json
cp ../test/data/example_entity_list.json \
 ../archive-app/src/assets/data/records.json
cp ../test/data/Climb\!London.csv \
 ../archive-app/src/assets/data/
cp ../test/data/narrativesLondon.csv \
 ../archive-app/src/assets/data/
cp ../test/data/mkGameEngine.xlsx \
 ../archive-app/src/assets/data/mkGameEngine.xlsx
cp ../test/data/empty_entity_list.json \
 ../archive-app/src/assets/data/performance-e888ea0f-8c81-48a8-8462-bc98dd04f495-annalist.json
cp ../test/data/empty_entity_list.json \
 ../archive-app/src/assets/data/performance-f01a5d26-6569-4879-9aef-58334110c307-annalist.json
```
Note, app data files to load in ../archive-app/src/assets/data/. See especially
urls.json (list of files to read).

At some point this should be wrapped up in an on-demand server.

## Midi files

MIDI files of notes
```
node lib/log2midi.js test/data/20170608T112725862Z-default.log
```

## Codes triggered
```
docker run --rm -it --name log \
 -v /vagrant/logs/logproc:/srv/archive/logs \
 -v /vagrant/html/1/archive/assets/data:/srv/archive/output \
 logproc /bin/sh
```

get musichub-performances.json from hub. Also later log files.

```
node lib/logs2codes.js output/codes_triggered.csv \
 output/codes_triggered_viz.json \
 output/mkGameEngine.xlsx output/climb-performances-20170608-w-am.json \
 output/musichub-performances.json \
 logs/20170608T112725862Z-default.log \
 logs/20180119T095247314Z-default.log \
 logs/processlog-upload-20180221T150958151Z.log \
 logs/processlog-upload-20180614T175953180Z.log \
 logs/20170825T202350715Z-default.log \
 ...
```

### Viz format

object:
- `performances`: array of `{` `id`, `title` `}`
- `stage`: array of `stage`

`stage` object with 
- `id`, 
- `path`: 0-2, 
- `level`: 0-9, 
- `codes`:array of codes 
- `performance_next`: map of performance id -> next stage id 

code, object:
- `id`
- `type` - "challenge", "trigger", "choice", "approach"
- `measure`
- `performance_code`: map of performance id -> `{` `played`, `time_in_stage` `}`

## Online

Configure log processing server (just processes musicodes logs to performances).
See `etc/config.yml`, e.g.:
```
logdir: logs
outputdir: output
annalistfiles:
 - ../test/data/example_entity_list.json
mvfile: ../test/data/Climb!June8.csv
narrativefile: ../test/data/narrativesJune8.csv
experiencefile: ../test/data/mkGameEngine.xlsx
httpuser: uploader
httppass: changeme
port: 4201
```

Run server
```
node lib/server.js [CONFIGFILE]
```

By default runs on port 4202 (see config) and accepts musicodes log file POST to `/api/1/processlog`.
e.g.
```
curl -X POST -H 'Content-type:application/binary' --data-binary @FILENAME http://uploader:changeme@localhost:8080/1/logproc/api/1/processlog
```
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
