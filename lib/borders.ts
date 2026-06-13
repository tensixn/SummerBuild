export type AvatarBorder = {
  id: string;
  name: string;
  price: number;
  image: string;
};

export const AVATAR_BORDERS: AvatarBorder[] = [
  {
    id: "silver",
    name: "Silver",
    price: 100,
    image: "https://static.vecteezy.com/system/resources/previews/060/511/985/non_2x/elegant-round-silver-frame-with-intricate-ornate-detailing-on-transparent-background-free-png.png",
  },
  {
    id: "ruby",
    name: "Ruby",
    price: 200,
    image: "https://static.vecteezy.com/system/resources/thumbnails/050/240/360/small/red-circular-neon-ring-free-png.png",
  },
  {
    id: "gold",
    name: "Gold",
    price: 300,
    image: "https://static.vecteezy.com/system/resources/thumbnails/059/246/456/small/golden-ornate-circle-frame-free-png.png",
  },
  {
    id: "diamond",
    name: "Diamond",
    price: 500,
    image: "https://static.vecteezy.com/system/resources/thumbnails/059/006/911/small/shiny-diamond-circle-frame-transparent-background-free-png.png",
  },
  {
    id: "champion",
    name: "Champion",
    price: 750,
    image: "https://static.vecteezy.com/system/resources/thumbnails/015/241/314/small/golden-luxury-lauren-wreath-illustration-award-decoration-element-png.png",
  },
];
