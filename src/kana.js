const rows=[
 ['あいうえお','a i u e o'],['かきくけこ','ka ki ku ke ko'],['さしすせそ','sa shi su se so'],['たちつてと','ta chi tsu te to'],['なにぬねの','na ni nu ne no'],['はひふへほ','ha hi fu he ho'],['まみむめも','ma mi mu me mo'],['や ゆ よ','ya _ yu _ yo'],['らりるれろ','ra ri ru re ro'],['わ   を','wa _ _ _ wo'],['ん    ','n _ _ _ _'],
 ['がぎぐげご','ga gi gu ge go'],['ざじずぜぞ','za ji zu ze zo'],['だぢづでど','da ji zu de do'],['ばびぶべぼ','ba bi bu be bo'],['ぱぴぷぺぽ','pa pi pu pe po']
];
export const kanaRows=rows.map(([chars,roma])=>[...chars].map((h,i)=>h===' '?null:({h,k:String.fromCharCode(h.charCodeAt(0)+0x60),r:roma.split(' ')[i]})));
export const yoon=[['きゃ','kya'],['きゅ','kyu'],['きょ','kyo'],['しゃ','sha'],['しゅ','shu'],['しょ','sho'],['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho'],['にゃ','nya'],['にゅ','nyu'],['にょ','nyo'],['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo'],['みゃ','mya'],['みゅ','myu'],['みょ','myo'],['りゃ','rya'],['りゅ','ryu'],['りょ','ryo'],['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo'],['じゃ','ja'],['じゅ','ju'],['じょ','jo'],['びゃ','bya'],['びゅ','byu'],['びょ','byo'],['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo']].map(([h,r])=>({h,k:[...h].map(c=>String.fromCharCode(c.charCodeAt(0)+0x60)).join(''),r}));
