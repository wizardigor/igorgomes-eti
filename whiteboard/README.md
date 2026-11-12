# Whiteboard — Igor Gomes ETI
Editor de animações de quadro branco: https://igorgomes.eti.br/whiteboard/

- Crie e reorganize cenas, textos, formas e imagens. Ajuste posição, rotação, tempo, pausas e transição.
- A ponta da mão segue os traços calculados. Imagens JPG/PNG/WebP passam por detecção Sobel e afinamento Zhang–Suen; a imagem em cores aparece ao final. Funciona melhor com ilustrações limpas e não recupera a ordem original do desenho.
- Seis instrumentos e seis tons de pele, além de cor livre. Entradas desenhada, colada e suave; transições com apagador, dissolver ou corte.
- Áudio por cena ou narração sintética local em português com variantes de voz, tom, velocidade e pausas como [pausa=0.5]. O áudio entra no vídeo exportado.
- Projetos JSON com mídias, desfazer/refazer, salvamento de rascunho no navegador, prévia e exportação em WebM/MP4 conforme suporte. Mantenha a aba visível. Limite de 3 minutos por exportação.

Para rodar o código do GitHub: execute `npm install` e `npm run preparar` para montar a voz local. Em seguida, sirva este diretório com python -m http.server 8000 e acesse http://localhost:8000. Não abra por file://. O GitHub traz o editor e a base móvel e de voz; o site hospeda a versão web. Android e iOS nativos ainda não foram compilados. A conexão de voz de referência é experimental e requer um servidor privado e modelo instalado por você.

O projeto utiliza GPL-3.0-or-later. Créditos, fonte e licença do sintetizador em vendor/ e LICENSE. A montagem local não envia imagens, áudio ou texto a um serviço de geração. A voz de referência só envia a amostra e o texto ao servidor informado após autorização.
