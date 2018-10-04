export interface PlaylistItem {
  title:string,
  performance:string,
  part:string,
  offset?:number,
  duration?:number
}

export class PlaylistInfo {
  title:string
  items?:PlaylistItem[]
}
