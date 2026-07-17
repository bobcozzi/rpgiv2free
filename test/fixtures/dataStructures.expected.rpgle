         ctl-opt BNDDIR('QC2LE')  OPTION(*NODEBUGIO : *SRCSTMT)
           DFTACTGRP(*NO) ACTGRP(*NEW);

         dcl-f DSPDTAQDF workstn INFDS(WSDS);

         dcl-pr DspDtaQD;
           DtaQ char(20);
         end-pr DspDtaQD;

         dcl-pi DspDtaQD;
           DtaQ char(20);
         end-pi DspDtaQD;

         dcl-pr rtvDtaQD  Extpgm('QMHQRDQD');
           RtnVariable char(2000) OPTIONS(*VARSIZE);
           RtnVarLen int(10) Const;
           APIFMT char(8) Const;
           DTAQ char(20) Const;
         end-pr rtvDtaQD;

         dcl-ds wsds INZ;
           FKey char(1) pos(369);
         end-ds wsds;

         dcl-ds PSDS PSDS;
           pgmName *PROC;
           CPFMSGID char(7) pos(40);
           CPFMSGD char(80) pos(91);
           MSGTEXT char(52) pos(91);
         end-ds PSDS;

         dcl-c F3 Const(X'33');
         dcl-c ENTER Const(X'F1');

         dcl-c TESTDESC Const('These are the times to remember, cause they will not last +
           forever. These are the days we''ll hold onto, but we won''t +
           although we''ll want to');

         dcl-ds DQDataF1 Inz;
           BytesRtn int(10);
           BytesAvail int(10) Inz(%size(DQDataF1));
           Max_Len int(10);
           Key_Len int(10);
           Q_Seq char(1);
           Sender_ID char(1);
           Force_Write char(1);
           TextDesc char(50);
           DtaQ_Type char(1);
           Auto_Rcl char(1);
           Reserved1 char(1);
           Cur_Msgs int(10);
           CurEntry_Cap int(10);
           DtaQName char(10);
           DtaQLib char(10);
           Max_Entry int(10);
           Init_Entry int(10);
         end-ds DQDataF1;

         dcl-ds DQDataF2 Inz;
           BytesRtn2 int(10);
           BytesAvail2 int(10) Inz(%size(DQDataF2));
           APPCDevD char(10);
           Mode_Name char(8);
           Rmt_Loc char(8);
           Lcl_Loc char(8);
           RmtNet_ID char(8);
           RmtDQName char(10);
           RmtDQLib char(10);
           DtaQName2 char(10);
           DtaQLib2 char(10);
         end-ds DQDataF2;
         dcl-s QSYSDATE date(*USA)  Inz(*SYS);
         dcl-s QSYSTIME time(*USA)  Inz(*SYS);
           *INLR = *ON;
