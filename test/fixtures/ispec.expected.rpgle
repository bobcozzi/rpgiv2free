dcl-ds cca9831_NS_01;
  RecID_Check Char(1) DIM(3) Pos(1);
  // TEST: read cca9831 cca9831_NS_01;
  // TEST: *IN01 = (RecID_Check(1) = 'A' and RecID_Check(3) <> 'D');
  item char(10);
  qty zoned(8:0) POS(5);
  descr char(35) POS(21);
          //  Sell price
  price zoned(7:2) POS(74);
  iclass char(2) POS(94);
  sclass char(2) POS(102);
  frt zoned(2:2) POS(108);
  duty char(2) POS(114);
  mrk zoned(2:2) POS(121);
end-ds cca9831_NS_01;