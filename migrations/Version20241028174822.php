<?php

declare(strict_types=1);

namespace main;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20241028174822 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE settings ADD animate_variation SMALLINT NOT NULL, ADD repertoire_engine_time SMALLINT NOT NULL, ADD analyse_engine_time SMALLINT NOT NULL, ADD analyse_ignore_inaccuracy TINYINT(1) NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE settings DROP animate_variation, DROP repertoire_engine_time, DROP analyse_engine_time, DROP analyse_ignore_inaccuracy');
    }
}
