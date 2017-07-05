# Music Archive

public (web) music archive, initially for performances of Climb! as
part of the EPSRC-funded FAST IMPACt project and the 
University of Nottingham Culture and Heritage RPA.

See docs

## Install / set up

```
npm install --no-bin-links
npm install -g @angular/cli
cd archive-app
npm install --no-bin-links
```

## archive app

dev
```
ng serve --host=0.0.0.0
```
build
```
bg build -bh /1/archive/
cd dist
tar zcf ../archive.tgz *
```
Copy to server and unpack.

## Process Logs

e.g.
```
node lib/processlogs.js test/data/example_entity_list.json \
  test/data/20170608T112725862Z-default.log 'test/data/Climb!June8.csv' \
  test/data/recordingsJune8.yml
```
Note, app files are in archive-app/src/assets/data/. See especially
urls.json (list of files to read).


MIDI files of notes
```
node lib/log2midi.js test/data/20170608T112725862Z-default.log
```

Music archive app (dev)
```
cd archive-app
ng serve --host=0.0.0.0
```
