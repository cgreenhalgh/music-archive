# Music Archive

public (web) music archive, initially for performances of Climb! as
part of the EPSRC-funded FAST IMPACt project and the 
University of Nottingham Culture and Heritage RPA.

See [docs/designnotes.md](docs/designnotes.md)

Note: branch linkapps is WIP to add a synchronized muzivisual app view.

## Install / set up

If using [Vagrant](https://www.vagrantup.com/), 
```
vagrant up
```

## Log processor

See [logproc/](logproc/)

## archive app

dev
```
cd ../archive-app
docker build -t archive-app .
docker run -it --rm --name=archive-app -p 4200:4200 -p 9876:9876 \
  archive-app /bin/bash
`npm bin`/ng serve --host=0.0.0.0
```
build
```
docker run -it --rm --name=archive-app \
  -v `pwd`:/root/work/output archive-app "cp archive.tgz /output/"
```
Copy to server and unpack.

## Popout video

Open archive with "?popout=" to get video in another window.

## Muzivisual app replay

See [docs/userinterface.md](docs/userinterface.md)...

Archive app opens 
```
app = window.open('http://localhost:8080/1/archive-muzivisual/', 'archive-muzivisual')
```

Waits for JSON-encoded window message with `version` `mrl-music.archive/1.0`

Archive-muzivisual is the contents of git repo https://github.com/cgreenhalgh/muzivisual 
branch "linkapps" directory "app/public".

It loads data from /1/archive-muzivisual/data/PERFID.json where ?p=PERFID

