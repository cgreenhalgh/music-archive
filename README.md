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
npm install -g @angular/cli
npm install --no-bin-links
ng serve --host=0.0.0.0
```
build
```
ng build -bh /1/archive/
cd dist
tar zcf ../archive.tgz *
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

