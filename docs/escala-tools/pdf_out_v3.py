# -*- coding: utf-8 -*-
import datetime as dt, runpy, os
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas

ns = runpy.run_path("escala_out_v3.py")
PLAN = ns["PLAN"]
OUT = "Escala UTI HCB - outubro 2026 - calendario.pdf"
CREME=HexColor("#FFFAF3");CREME2=HexColor("#FAF3E8");INK=HexColor("#3A2E2A");INK2=HexColor("#6B5C56")
INK3=HexColor("#9A8A82");LINE=HexColor("#DAD3CD");LAVI=HexColor("#5A4E8C");LAV=HexColor("#A299CB")
LAVS=HexColor("#ECEAF4");AQUAI=HexColor("#6FA6CF");SANDS=HexColor("#FBF1E1");CORALI=HexColor("#C77264")
CORALS=HexColor("#FBE9E5");BLUES=HexColor("#EAF2F9");PINK=HexColor("#E79BC4")
MM=72/25.4; W,H=landscape(A3)

def day_lists(d):
    m,t,n,extra=[],[],[],[]
    for ap,plan in sorted(PLAN.items()):
        c=plan.get(d)
        if not c or c in ("FE","LM","A"): continue
        if c=="M": m.append(ap)
        elif c=="T": t.append(ap)
        elif c=="D": m.append(ap); t.append(ap)
        elif c=="C": m.append(ap+"*"); t.append(ap+"*")
        elif c=="J": m.append(ap)
        elif c=="N": n.append(ap)
        elif c=="NT": n.append(ap+" (19-1h)")
        elif c=="E": extra.append(ap+" · CEP")
        elif c=="P": m.append(ap+" (CP)")
        elif c=="R": t.append(ap+" (CRO)")
        elif c=="AB": extra.append(ap+" · abono aniversário")
    return m,t,n,extra

def wrap(c,names,font,size,maxw):
    lines,cur=[],""
    for nm in names:
        cand=(cur+" · " if cur else "")+nm
        if c.stringWidth(cand,font,size)<=maxw: cur=cand
        else:
            if cur: lines.append(cur)
            cur=nm
    if cur: lines.append(cur)
    return lines

c=canvas.Canvas(OUT,pagesize=landscape(A3))
c.setTitle("Escala UTI HCB · outubro 2026")
c.setFillColor(CREME); c.rect(0,0,W,H,stroke=0,fill=1)
MARG=11*MM; top=H-MARG
c.setFillColor(LAVI); c.setFont("Helvetica-Bold",22)
c.drawString(MARG,top-16,"escala UTI HCB · outubro 2026")
c.setFillColor(CORALI); c.setFont("Helvetica-Bold",11)
c.drawString(MARG+340,top-16,"v2 · 18/08 — 58 preferências · Laura e Moabe provisórios · pendências na planilha")
c.setFillColor(INK2); c.setFont("Helvetica",9)
c.drawRightString(W-MARG,top-16,"* chefia/rotina · (CP) paliativo · (CRO)/CEP fixos · feriado 12/10 N. Sra. Aparecida")
grid_top=top-30
WD=["segunda","terça","quarta","quinta","sexta","sábado","domingo"]
grid_h=grid_top-MARG-14; col_w=(W-2*MARG)/7; hdr_h=14; row_h=(grid_h-hdr_h)/5
for j,wdn in enumerate(WD):
    x=MARG+j*col_w
    c.setFillColor(LAVI); c.rect(x,grid_top-hdr_h,col_w,hdr_h,stroke=0,fill=1)
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold",9)
    c.drawCentredString(x+col_w/2,grid_top-hdr_h+4,wdn)
first=dt.date(2026,10,1).weekday()
cells={d:((first+d-1)//7,(first+d-1)%7) for d in range(1,32)}
FN,SZ="Helvetica",6.3; LH=SZ+1.6
for d in range(1,32):
    r,col=cells[d]; x=MARG+col*col_w
    y_top=grid_top-hdr_h-r*row_h; y_bot=y_top-row_h
    fer=d==12
    c.setFillColor(CORALS if fer else (CREME2 if col>=5 else HexColor("#FFFFFF")))
    c.rect(x,y_bot,col_w,row_h,stroke=0,fill=1)
    c.setStrokeColor(LINE); c.setLineWidth(0.7); c.rect(x,y_bot,col_w,row_h,stroke=1,fill=0)
    pad=4; cy=y_top-12
    c.setFillColor(CORALI if fer else (INK2 if col>=5 else LAVI))
    c.setFont("Helvetica-Bold",12); c.drawString(x+pad,cy,str(d))
    if fer:
        c.setFont("Helvetica-Bold",6.5); c.drawString(x+pad+16,cy+1,"FERIADO · N. SRA. APARECIDA (rotina folga)")
    m,t,n,extra=day_lists(d)
    pos={"cy":cy-4}
    def band(label,names,bg,label_color):
        cy=pos["cy"]
        if not names: return
        lines=wrap(c,names,FN,SZ,col_w-2*pad-14)
        bh=len(lines)*LH+3.5
        c.setFillColor(bg); c.rect(x+1.5,cy-bh,col_w-3,bh,stroke=0,fill=1)
        c.setFillColor(label_color); c.setFont("Helvetica-Bold",6.5)
        c.drawString(x+pad-1,cy-LH+0.5,label)
        c.setFillColor(INK); c.setFont(FN,SZ)
        yy=cy-LH+0.5
        for ln in lines:
            c.drawString(x+pad+11,yy,ln); yy-=LH
        pos["cy"]=cy-bh-1.6
    band("M",m,SANDS,HexColor("#B98A3E"))
    band("T",t,BLUES,AQUAI)
    band("N",n,LAVS,LAVI)
    for ex in extra:
        c.setFillColor(PINK if "abono" in ex else INK3)
        c.setFont("Helvetica-Oblique",6.2)
        c.drawString(x+pad-1,pos["cy"]-LH+1,"★ "+ex if "abono" in ex else ex)
        pos["cy"]-=LH
c.setFillColor(INK3); c.setFont("Helvetica",8)
c.drawString(MARG,MARG-2,
  "Ausências — férias: Rosana (até 12) · LeLemos, Letícia, João, Thamyres (até 5-6) · Amanda (até 11) · Kozak e Raquel (5–19) · Vinicius (12–26) · Aline, Neyde, Bruna (19+) · "
  "licenças: Yuji (~9–28, DPP) · Ariadne (volta 26/10) · abono: MayWobido 31/10 · fora de BSB: Amélio (24–31, BHN)")
c.setFillColor(LAV); c.setFont("Helvetica-Bold",8)
c.drawRightString(W-MARG,MARG-2,"colo · ritmo")
c.save()
print("OK ->",OUT,round(os.path.getsize(OUT)/1024),"kb")
