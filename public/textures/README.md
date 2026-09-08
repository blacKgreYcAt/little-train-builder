# 貼圖規格

把生成好的圖片放進這個資料夾,檔名照下表。**不用一次生完**,做好幾張我就接幾張,
照優先順序來效果最好。

## 共通要求(這幾條沒做到會很明顯)

| 項目 | 要求 | 為什麼 |
|---|---|---|
| **無縫平鋪** | 生成時要開 seamless / tileable | 地面會重複上百次,有接縫就會看到格子 |
| **正上方俯視** | 平的樣本,不要有透視、不要有地平線 | 有透視的圖貼到地上會歪掉 |
| **平光** | 陰天散射光,**不要有陰影、高光、暗角** | 光影已經由 3D 引擎算,圖上再帶一套會打架 |
| **尺寸** | 1024×1024(最多 2048),正方形 | 2 的次方對 GPU 最友善 |
| **格式** | `.jpg`(雲用 `.png`,要透明背景) | |
| **風格** | 半寫實:有真實質感但乾淨一點、彩度稍高 | 要同時搭得上照片駕駛艙和卡通火車 |

## 清單(照優先順序)

### 1. `grass.jpg` — 草地 ★最高優先
地面是畫面裡最大的一片,這張效果最明顯。

> Seamless tileable texture of English meadow grass, top-down orthographic view,
> flat even overcast lighting, no shadows, no highlights, short mixed green grass
> with subtle variation, semi-realistic, 1024x1024

### 2. `ballast.jpg` — 道碴(鐵軌下的碎石)
駕駛艙視角裡就在眼前,速度感全靠它。

> Seamless tileable texture of railway track ballast, crushed grey and brown
> angular stones, top-down orthographic view, flat even lighting, no shadows,
> semi-realistic, 1024x1024

### 3. `stone.jpg` — 石材(橋、隧道口)

> Seamless tileable texture of weathered Victorian stone masonry blocks, grey
> limestone with mortar joints, top-down flat view, even overcast lighting,
> no shadows, semi-realistic, 1024x1024

### 4. `wood.jpg` — 木頭(枕木、月台、柵欄)

> Seamless tileable texture of weathered dark creosoted timber planks, wood grain
> visible, top-down flat view, even lighting, no shadows, semi-realistic, 1024x1024

### 5. `roof.jpg` — 屋瓦(車站)

> Seamless tileable texture of old red clay roof tiles in rows, top-down flat view,
> even overcast lighting, no shadows, semi-realistic, 1024x1024

### 6. `rock.jpg` — 土壁岩面(路塹、路堤)

> Seamless tileable texture of exposed earth and rock cutting face, brown soil with
> embedded stones and patches of grass, top-down flat view, even lighting,
> no shadows, semi-realistic, 1024x1024

### 7. `cloud.png` — 雲(選配,要透明背景)
不用平鋪。單獨一團蓬鬆白雲,**背景全透明**。

> Single fluffy white cumulus cloud, isolated on fully transparent background,
> soft edges, no ground, no sky, front view, 1024x1024 PNG with alpha

## 兩件不用擔心的事

- **不用生 3D 模型**,AI 目前生的 3D 品質不堪用,而且我這邊也接不進來。只要平面貼圖。
- **不用生法線貼圖(normal map)**。我可以從顏色圖直接推算出凹凸感,你只要給顏色圖。

## 如果 AI 做不出無縫的怎麼辦

草地、道碴、土壁這種**有機、無方向性**的貼圖,就算不是無縫的我也能用鏡像平鋪的方式
把接縫藏掉,品質不會差太多。

但**磚、石塊、屋瓦、木板**這種有規則紋路的,鏡像會看出來對稱很假,這幾張比較需要
真的無縫。生成時記得把 seamless / tileable 選項打開。
