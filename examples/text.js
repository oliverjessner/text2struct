import { convert } from 'text2struct';

const input = `
pixelpanda
20.2K  
https://www.tiktok.com/@pixelpanda

mondfeder
11.3K
https://www.tiktok.com/@mondfeder

neonfuchs
6235 
https://www.tiktok.com/@neonfuchs

wolkenwerk.ai
25.9K 
https://www.tiktok.com/@wolkenwerk.ai

kaffeekomet
3846
https://www.tiktok.com/@kaffeekomet

bytebiene.x0
30.9K
https://www.tiktok.com/@bytebiene.x0

lachlabor
5512
https://www.tiktok.com/@lachlabor

quickotter_
38.9K
https://www.tiktok.com/@quickotter_

sternenladen3
53.3K
https://www.tiktok.com/@sternenladen3

datadachs
22.2K
https://www.tiktok.com/@datadachs

sternenladen3
53.3K
https://www.tiktok.com/@sternenladen3

morgenfunk60
849
https://www.tiktok.com/@morgenfunk60

ki.kichert.mit
360
https://www.tiktok.com/@ki.kichert.mit

blitzpost
9997
https://www.tiktok.com/@blitzpost

fruchtfunke
11.2K
https://www.tiktok.com/@fruchtfunke

apfelcartoons
51K
https://www.tiktok.com/@apfelcartoons

codekatze01
7045
https://www.tiktok.com/@codekatze01

ZEITFLUX
1234
https://www.tiktok.com/@zeitflux
`;

const options = {
    input,
    schema: {
        name: 'string',
        follower: 'string',
        url: 'string',
    },
    parser: {
        type: 'lines',
    },
    deduplicate: true,
};
const jsonOutput = convert({
    ...options,
    output: 'json',
});
const csvOutput = convert({
    ...options,
    output: 'csv',
});
const mdOutput = convert({
    ...options,
    output: 'markdown',
});
const yamlOutput = convert({
    ...options,
    output: 'yaml',
});
const sqliteOutput = convert({
    ...options,
    output: 'sqlite',
});

console.log(jsonOutput);
console.log(csvOutput);
console.log(mdOutput);
console.log(yamlOutput);
console.log(sqliteOutput);
