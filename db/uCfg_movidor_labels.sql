/* Friendly labels for the RRD Movidor parameters, taken from the UI section
   code (door_section.py). Run on the config DB to replace the raw control-name
   labels the seed used. Re-runnable. */
SET NOCOUNT ON;
DECLARE @Cfg INT = (SELECT TOP 1 CfgID FROM dbo.uCfgConfigurators WHERE PartID = N'RRD-MOVIDOR-TEMPLATE');
IF @Cfg IS NULL BEGIN RAISERROR('RRD-MOVIDOR-TEMPLATE not found.',16,1); RETURN; END;

UPDATE p SET Label = v.Label
FROM dbo.uCfgParameters p
JOIN (VALUES
    ('CMBDOORMODEL','Door Model'),
    ('NUMDOORHEIGHT','Door Height (mm)'),
    ('NUMDOORWIDTH','Door Width (mm)'),
    ('QTY','Quantity'),
    ('CMBGPOISO','GPO / Isolator'),
    ('CMBMOTORORIDE','Hand Crank / Chain Drive'),
    ('CMBTRACKCONFIG','Tracks Proud / Conc?'),
    ('CMBWINDTRACK','High Wind Tracks Required'),
    ('CMBELECSPEC','Electrical Spec'),
    ('CMBPOWERSUPPLY','Power Supply'),
    ('CMBCONTROLLERENCLOSURE','Controller Enclosure'),
    ('CMBMOTORSHROUD','Motor Shroud'),
    ('CMBMOTORSPEC','Brake / VSD Protection'),
    ('CMBBRUSHSEAL','Brush Seal'),
    ('CMBTRAFFICLIGHT','Traffic Light'),
    ('CMBPEBEAMS','PE Beam'),
    ('CMBUPS','UPS'),
    ('CMBCUSTSTEEL','Custom Steel Work'),
    ('CMBREARHOODBRUSHSEAL','Rear Hood Brush Seal'),
    ('CMBSPECIALCONDUIT','Conduit'),
    ('CMBCOLOURFINISHTYPE','Powdercoat / Painting'),
    ('CMBES40FASCIA','Fascia'),
    ('CMBES40VSDMTR','VSD Motor'),
    ('CMBHEATTRACELEG','Heat Trace Legs'),
    ('CMBGEARBOXHEATER','Gearbox Heater'),
    ('CMBHEATTRACEHOOD','Heat Trace In Hood'),
    ('CMBFELTSEAL','Felt Seal'),
    ('CMBFLOORLOOPINSTALL','Floor Loop Installation'),
    ('CHKHYPERLIFT','Hyperlift Motor'),
    ('CHKHOLDOPEN','Hold Open Switch'),
    ('CHKINTERLOCK','Interlock'),
    ('CHKSTAINLESS','Movisan (Stainless)'),
    ('CHKEX35FELT','EX35 Felt'),
    ('CHKMOTORCLEARCOAT','Motor Clear Coat'),
    ('CMBPED1','Pedestrian Button 1'),
    ('CMBPED2','Pedestrian Button 2'),
    ('CMBRADAR1','Door Side Radar'),
    ('CMBRADAR2','Non-Door Side Radar'),
    ('CMBACT1','Activation 1'),
    ('CMBACT2','Activation 2'),
    ('CMBACT3','Activation 3'),
    ('CMBACT4','Activation 4'),
    ('NUMREMOTEQTY1','Remote Qty 1'),
    ('NUMREMOTEQTY2','Remote Qty 2'),
    ('NUMREMOTEQTY3','Remote Qty 3'),
    ('NUMREMOTEQTY4','Remote Qty 4'),
    ('CMBBRAKEIPBASIC','Brake IP Basic'),
    ('CMBCABLELENGTH','Cable Length'),
    ('CMBCURTAINCOLOUR','Curtain Colour'),
    ('CMBMOTORHAND','Motor Hand'),
    ('CMBACT5','Activation 5')
) AS v(ControlName, Label) ON v.ControlName = p.ControlName
WHERE p.CfgID = @Cfg;

PRINT 'Movidor labels updated.';
