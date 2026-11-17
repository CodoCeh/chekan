## Что это и когда брать
ImageMagick (программа `magick` для обработки картинок из командной строки) и Pillow (библиотека Python для картинок) меняют размер, обрезают, сжимают и склеивают изображения. Бери их для обложек, баннеров, иллюстраций под требования площадки. Не бери для рисования графиков — это учебник `charts`. Не бери для ретуши лиц и сложного дизайна: это работа дизайнера.

## Установка и проверка
```bash
magick -version | head -1; python3 -c "import PIL; print('Pillow', PIL.__version__)"
```
Если Pillow нет — без установки: `uv run --with pillow python script.py`. ImageMagick ставится пакетным менеджером — только после «да» пользователя.

## Порядок работы
1. Узнай требования площадки: размер в пикселях, пропорции, формат, лимит веса файла.
2. Работай с копией. Исходник в высоком разрешении сохрани без изменений.
3. Сначала обрежь под пропорции, потом уменьшай. Увеличение даёт мыло.
4. Сожми в webp для сайта или jpg для площадок, где webp не принимают. PNG оставь для схем и скриншотов с текстом.
5. Проверь размеры и вес каждого файла командой и посмотри результат глазами на листе-превью.

## Готовые команды
Шрифт с кириллицей. Без `-font` ImageMagick не пишет текст вообще:
```bash
FONT=$(fc-match -f '%{file}' 'sans-serif:lang=ru'); echo "$FONT"
```
Тестовый исходник, обрезка под 1200×630, сжатие, превью до 800 px:
```bash
magick -size 3000x2000 gradient:"#3B6EA5-#F2C14E" -font "$FONT" -gravity center -pointsize 160 -fill white -annotate 0 "Обложка" source.png
magick source.png -resize 1200x630^ -gravity center -extent 1200x630 cover_1200x630.png
magick cover_1200x630.png -quality 82 cover.webp
magick cover_1200x630.png -strip -quality 85 cover.jpg
magick source.png -resize '800x800>' thumb.png
```
Лист-превью с подписями. `-label` ставится до списка файлов:
```bash
magick montage -font "$FONT" -label '%f %wx%h %b' cover.jpg thumb.png cover.webp -tile 3x1 -geometry 400x300+10+10 -background white -title "Варианты обложки" sheet.png
```
Проверка размеров и веса:
```bash
magick identify -format "%f %wx%h %b\n" cover.jpg cover.webp thumb.png
```
Вписать в лимит веса через Pillow. Аргументы: исходник, результат, длинная сторона, лимит в КБ. Сохрани как `fit_size.py`:
```python
import sys
from pathlib import Path
from PIL import Image, ImageOps
src, dst, max_side, max_kb = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
im.thumbnail((max_side, max_side))
for q in range(90, 39, -5):
    im.save(dst, quality=q, optimize=True)
    kb = Path(dst).stat().st_size / 1024
    if kb <= max_kb:
        break
print(f"{dst}: {im.width}x{im.height}, {kb:.0f} КБ, качество {q}")
if kb > max_kb:
    sys.exit("не влезло в лимит — уменьшай размер в пикселях")
```
```bash
python3 fit_size.py source.png post.jpg 1600 120
python3 fit_size.py source.png post.webp 1600 60
```

## Частые ошибки
- `-resize 1200x630` без `^` вписывает картинку внутрь: из 3000×2000 выйдет 945×630. Для точного размера нужны `^` и `-extent`.
- Текст через `magick` без `-font`: ошибка «unable to read font», файл не создаётся.
- Шрифт без кириллицы: вместо букв квадраты. Проверяй картинку глазами.
- Фото с телефона лежит на боку: не учтён поворот из EXIF (метаданные снимка). Помогает `ImageOps.exif_transpose`.
- PNG с прозрачностью сохраняют в jpg без `.convert("RGB")` — Pillow падает с ошибкой.
- В jpg остались EXIF с геометкой. Для публикации снимай их: `-strip` в magick, пересохранение в Pillow без `exif=`.
- Сжатие до качества 40 ради веса. Лучше уменьши размер в пикселях.

## След для Проверяющего
В папку результатов задачи: итоговые файлы, лист-превью `sheet.png`, вывод `magick identify` (имя, размер, вес) и строку с требованиями площадки, под которые всё подгонялось.
